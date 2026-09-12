use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::AgroError;
use crate::state::{Campaign, CampaignStatus, CAMPAIGN_SEED};

#[derive(Accounts)]
pub struct ReleaseFunds<'info> {
    pub producer: Signer<'info>,

    #[account(
        mut,
        has_one = producer @ AgroError::Unauthorized,
        seeds = [
            CAMPAIGN_SEED,
            campaign.producer.as_ref(),
            &campaign.campaign_id.to_le_bytes()
        ],
        bump = campaign.bump,
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(mut, address = campaign.vault)]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = campaign.usdc_mint,
        token::authority = producer,
    )]
    pub producer_usdc: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ReleaseFunds>) -> Result<()> {
    let campaign = &mut ctx.accounts.campaign;
    require!(campaign.status == CampaignStatus::Open, AgroError::CampaignNotOpen);
    require!(campaign.tons_sold >= campaign.min_tons, AgroError::MinNotReached);

    // Leer saldo real del vault (spec §9 - trampas conocidas).
    let amount = ctx.accounts.vault.amount;

    // CPI: transfer vault → producer_usdc. Firma la PDA `campaign` (dueña del vault).
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
                to: ctx.accounts.producer_usdc.to_account_info(),
                authority: campaign.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    campaign.status = CampaignStatus::Funded;
    Ok(())
}
