use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, MintTo, Token, TokenAccount, Transfer},
};

use crate::errors::AgroError;
use crate::state::{Campaign, CampaignStatus, CAMPAIGN_SEED};

#[derive(Accounts)]
pub struct Invest<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,

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
        token::mint = campaign.usdc_mint,
        token::authority = investor,
    )]
    pub investor_usdc: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = investor,
        associated_token::mint = token_mint,
        associated_token::authority = investor,
    )]
    pub investor_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<Invest>, tons: u64) -> Result<()> {
    require!(tons > 0, AgroError::InvalidParams);

    let campaign = &mut ctx.accounts.campaign;
    require!(campaign.status == CampaignStatus::Open, AgroError::CampaignNotOpen);

    let now = Clock::get()?.unix_timestamp;
    require!(now < campaign.sale_end, AgroError::SaleEnded);

    let new_sold = campaign
        .tons_sold
        .checked_add(tons)
        .ok_or(AgroError::MathOverflow)?;
    require!(new_sold <= campaign.tons_offered, AgroError::ExceedsOffer);

    let usdc_amount = tons
        .checked_mul(campaign.price_per_ton)
        .ok_or(AgroError::MathOverflow)?;

    // CPI #1: transfer USDC investor_usdc → vault.
    // Firma: `investor` (humano dueño de investor_usdc). Ya firmó la tx, no hacen falta signer_seeds.
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.investor_usdc.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.investor.to_account_info(),
            },
        ),
        usdc_amount,
    )?;

    // CPI #2: mint_to token_mint → investor_token.
    // Firma: PDA `campaign` (mint authority). Reproducimos las seeds y el bump para que el runtime
    // valide que la PDA declarada = la que autoriza.
    let producer_key = campaign.producer;
    let campaign_id_bytes = campaign.campaign_id.to_le_bytes();
    let bump = campaign.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[
        CAMPAIGN_SEED,
        producer_key.as_ref(),
        &campaign_id_bytes,
        std::slice::from_ref(&bump),
    ]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.investor_token.to_account_info(),
                authority: campaign.to_account_info(),
            },
            signer_seeds,
        ),
        tons,
    )?;

    campaign.tons_sold = new_sold;
    Ok(())
}
