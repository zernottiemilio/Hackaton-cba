use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, Token, TokenAccount, Transfer},
};

use crate::errors::AgroError;
use crate::state::{Campaign, CampaignStatus, CAMPAIGN_SEED};

#[derive(Accounts)]
pub struct Redeem<'info> {
    #[account(mut)]
    pub holder: Signer<'info>,

    #[account(
        mut,
        seeds = [
            CAMPAIGN_SEED,
            campaign.producer.as_ref(),
            &campaign.campaign_id.to_le_bytes()
        ],
        bump = campaign.bump,
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(mut, address = campaign.token_mint)]
    pub token_mint: Account<'info, Mint>,

    #[account(mut, address = campaign.vault)]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = token_mint,
        token::authority = holder,
    )]
    pub holder_token: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = holder,
        associated_token::mint = usdc_mint,
        associated_token::authority = holder,
    )]
    pub holder_usdc: Account<'info, TokenAccount>,

    #[account(address = campaign.usdc_mint)]
    pub usdc_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<Redeem>, amount: u64) -> Result<()> {
    require!(amount > 0, AgroError::InvalidParams);
    let campaign = &mut ctx.accounts.campaign;
    require!(
        campaign.status == CampaignStatus::Settled,
        AgroError::CampaignNotSettled
    );
    require!(
        ctx.accounts.holder_token.amount >= amount,
        AgroError::InsufficientTokens
    );

    // CPI: burn `amount` tokens de holder_token. Firma el humano `holder`.
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.token_mint.to_account_info(),
                from: ctx.accounts.holder_token.to_account_info(),
                authority: ctx.accounts.holder.to_account_info(),
            },
        ),
        amount,
    )?;

    let payout = amount
        .checked_mul(campaign.payout_per_token)
        .ok_or(AgroError::MathOverflow)?;

    // CPI: transfer vault → holder_usdc. Firma la PDA `campaign`.
    let producer_key = campaign.producer;
    let campaign_id_bytes = campaign.campaign_id.to_le_bytes();
    let bump = campaign.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[
        CAMPAIGN_SEED,
        producer_key.as_ref(),
        &campaign_id_bytes,
        std::slice::from_ref(&bump),
    ]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.holder_usdc.to_account_info(),
                authority: campaign.to_account_info(),
            },
            signer_seeds,
        ),
        payout,
    )?;

    Ok(())
}
