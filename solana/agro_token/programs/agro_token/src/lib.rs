use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

pub use errors::*;
pub use instructions::*;
pub use state::*;

declare_id!("DKnf1N2UvAwEfa6eu32F5hSE1UVCc3iK2mbjP84FRMy5");

#[program]
pub mod agro_token {
    use super::*;

    pub fn create_campaign(
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
        instructions::create_campaign::handler(
            ctx,
            campaign_id,
            crop,
            season,
            tons_offered,
            min_tons,
            price_per_ton,
            sale_end,
            settlement_date,
            acopio,
        )
    }

    pub fn invest(ctx: Context<Invest>, tons: u64) -> Result<()> {
        instructions::invest::handler(ctx, tons)
    }

    pub fn release_funds(ctx: Context<ReleaseFunds>) -> Result<()> {
        instructions::release_funds::handler(ctx)
    }

    pub fn settle(
        ctx: Context<Settle>,
        tons_delivered: u64,
        settlement_price: u64,
    ) -> Result<()> {
        instructions::settle::handler(ctx, tons_delivered, settlement_price)
    }

    pub fn redeem(ctx: Context<Redeem>, amount: u64) -> Result<()> {
        instructions::redeem::handler(ctx, amount)
    }
}
