use anchor_lang::prelude::*;

pub const CAMPAIGN_SEED: &[u8] = b"campaign";
pub const MINT_SEED: &[u8] = b"mint";

#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub producer: Pubkey,
    pub acopio: Pubkey,
    pub campaign_id: u64,
    pub crop: [u8; 16],
    pub season: [u8; 8],
    pub tons_offered: u64,
    pub min_tons: u64,
    pub price_per_ton: u64,
    pub tons_sold: u64,
    pub sale_end: i64,
    pub settlement_date: i64,
    pub status: CampaignStatus,
    pub tons_delivered: u64,
    pub settlement_price: u64,
    pub payout_per_token: u64,
    pub usdc_mint: Pubkey,
    pub token_mint: Pubkey,
    pub vault: Pubkey,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum CampaignStatus {
    Draft,
    Open,
    Funded,
    Settled,
    Failed,
}
