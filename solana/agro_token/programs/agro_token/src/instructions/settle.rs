use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::AgroError;
use crate::state::{Campaign, CampaignStatus, CAMPAIGN_SEED};

#[derive(Accounts)]
pub struct Settle<'info> {
    pub acopio: Signer<'info>,

    #[account(
        mut,
        has_one = acopio @ AgroError::Unauthorized,
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
        token::authority = acopio,
    )]
    pub acopio_usdc: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<Settle>,
    tons_delivered: u64,
    settlement_price: u64,
) -> Result<()> {
    let campaign = &mut ctx.accounts.campaign;
    require!(campaign.status == CampaignStatus::Funded, AgroError::CampaignNotFunded);

    let now = Clock::get()?.unix_timestamp;
    require!(now >= campaign.settlement_date, AgroError::TooEarly);

    require!(
        tons_delivered > 0 && tons_delivered <= campaign.tons_sold,
        AgroError::InvalidDelivery
    );
    require!(settlement_price > 0, AgroError::InvalidParams);

    let deposit = tons_delivered
        .checked_mul(settlement_price)
        .ok_or(AgroError::MathOverflow)?;

    // CPI: transfer acopio_usdc → vault. Firma el humano `acopio`.
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.acopio_usdc.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.acopio.to_account_info(),
            },
        ),
        deposit,
    )?;

    let payout = deposit / campaign.tons_sold; // división entera; polvo queda en vault
    campaign.tons_delivered = tons_delivered;
    campaign.settlement_price = settlement_price;
    campaign.payout_per_token = payout;
    campaign.status = CampaignStatus::Settled;

    Ok(())
}
