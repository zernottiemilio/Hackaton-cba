use anchor_lang::prelude::*;

#[error_code]
pub enum AgroError {
    #[msg("Parametros invalidos")]
    InvalidParams,
    #[msg("Fechas invalidas: se requiere now < sale_end < settlement_date")]
    InvalidDates,
    #[msg("La campania no esta abierta")]
    CampaignNotOpen,
    #[msg("La venta cerro")]
    SaleEnded,
    #[msg("Excede el cupo ofrecido")]
    ExceedsOffer,
    #[msg("Overflow aritmetico")]
    MathOverflow,
    #[msg("No autorizado")]
    Unauthorized,
    #[msg("No se alcanzo el minimo para liberar fondos")]
    MinNotReached,
    #[msg("La campania no esta fondeada")]
    CampaignNotFunded,
    #[msg("Todavia no se puede liquidar")]
    TooEarly,
    #[msg("Entrega invalida")]
    InvalidDelivery,
    #[msg("La campania no esta liquidada")]
    CampaignNotSettled,
    #[msg("Tokens insuficientes")]
    InsufficientTokens,
    #[msg("Refund no disponible")]
    RefundNotAvailable,
}
