use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::errors::AgroError;
use crate::state::{Campaign, CampaignStatus, CAMPAIGN_SEED, MINT_SEED};

#[derive(Accounts)]
#[instruction(campaign_id: u64)]
pub struct CreateCampaign<'info> {
    #[account(mut)]
    pub producer: Signer<'info>,

    #[account(
        init,
        payer = producer,
        space = 8 + Campaign::INIT_SPACE,
        seeds = [CAMPAIGN_SEED, producer.key().as_ref(), &campaign_id.to_le_bytes()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
        init,
        payer = producer,
        seeds = [MINT_SEED, campaign.key().as_ref()],
        bump,
        mint::decimals = 0,
        mint::authority = campaign,
    )]
    pub token_mint: Account<'info, Mint>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = producer,
        associated_token::mint = usdc_mint,
        associated_token::authority = campaign,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<CreateCampaign>,
    campaign_id: u64,
    crop: [u8; 16],
    season: [u8; 8],
    tons_offered: u64,
    min_tons: u64,
    price_per_ton: u64,
    sale_end: i64,
    settlement_date: i64,
    acopio: Pubkey,
) -> Result<()> {
    require!(tons_offered > 0, AgroError::InvalidParams);
    require!(
        min_tons > 0 && min_tons <= tons_offered,
        AgroError::InvalidParams
    );
    require!(price_per_ton > 0, AgroError::InvalidParams);

    let now = Clock::get()?.unix_timestamp;
    require!(now < sale_end, AgroError::InvalidDates);
    require!(sale_end < settlement_date, AgroError::InvalidDates);

    let campaign = &mut ctx.accounts.campaign;
    campaign.producer = ctx.accounts.producer.key();
    campaign.acopio = acopio;
    campaign.campaign_id = campaign_id;
    campaign.crop = crop;
    campaign.season = season;
    campaign.tons_offered = tons_offered;
    campaign.min_tons = min_tons;
    campaign.price_per_ton = price_per_ton;
    campaign.tons_sold = 0;
    campaign.sale_end = sale_end;
    campaign.settlement_date = settlement_date;
    campaign.status = CampaignStatus::Open;
    campaign.tons_delivered = 0;
    campaign.settlement_price = 0;
    campaign.payout_per_token = 0;
    campaign.usdc_mint = ctx.accounts.usdc_mint.key();
    campaign.token_mint = ctx.accounts.token_mint.key();
    campaign.vault = ctx.accounts.vault.key();
    campaign.bump = ctx.bumps.campaign;

    Ok(())
}
