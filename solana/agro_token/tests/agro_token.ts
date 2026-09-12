import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { AgroToken } from "../target/types/agro_token";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  getMint,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { assert, expect } from "chai";

const CAMPAIGN_SEED = Buffer.from("campaign");
const MINT_SEED = Buffer.from("mint");

const toU64Le = (n: BN) => n.toArrayLike(Buffer, "le", 8);

const padBytes = (s: string, len: number) => {
  const buf = Buffer.alloc(len);
  buf.write(s);
  return Array.from(buf);
};

const airdrop = async (
  connection: anchor.web3.Connection,
  pubkey: PublicKey,
  sol: number,
) => {
  const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig);
};

describe("agro_token", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.AgroToken as Program<AgroToken>;
  const connection = provider.connection;

  // Wallets
  const producer = Keypair.generate();
  const investorA = Keypair.generate();
  const investorB = Keypair.generate();
  const acopio = Keypair.generate();

  // USDC mock mint (6 decimals) controlado por fee-payer del provider
  let usdcMint: PublicKey;
  let producerUsdc: PublicKey;
  let investorAUsdc: PublicKey;
  let investorBUsdc: PublicKey;
  let acopioUsdc: PublicKey;

  // Campaign params (spec §7.1)
  const campaignId = new BN(1);
  const crop = padBytes("soja", 16);
  const season = padBytes("2025/26", 8);
  const tonsOffered = new BN(300);
  const minTons = new BN(200);
  const pricePerTon = new BN(250_000_000); // 250 USDC (6 decimales)

  // Fechas: sale_end en +30s, settlement_date en +8s. Tests correran suficientemente rápido y
  // el settle usa un sleep para pasar settlement_date.
  const now = Math.floor(Date.now() / 1000);
  const saleEnd = new BN(now + 60);
  const settlementDate = new BN(now + 70);

  // PDAs derivadas después de conocer producer.publicKey
  let campaignPda: PublicKey;
  let campaignBump: number;
  let tokenMintPda: PublicKey;
  let vaultPda: PublicKey; // ATA

  before(async () => {
    // Airdrops
    await airdrop(connection, producer.publicKey, 10);
    await airdrop(connection, investorA.publicKey, 10);
    await airdrop(connection, investorB.publicKey, 10);
    await airdrop(connection, acopio.publicKey, 10);

    // USDC mock (fee-payer del provider como mint authority)
    usdcMint = await createMint(
      connection,
      (provider.wallet as anchor.Wallet).payer,
      provider.wallet.publicKey,
      null,
      6,
    );

    // ATAs de USDC para todos
    producerUsdc = await createAssociatedTokenAccount(
      connection,
      (provider.wallet as anchor.Wallet).payer,
      usdcMint,
      producer.publicKey,
    );
    investorAUsdc = await createAssociatedTokenAccount(
      connection,
      (provider.wallet as anchor.Wallet).payer,
      usdcMint,
      investorA.publicKey,
    );
    investorBUsdc = await createAssociatedTokenAccount(
      connection,
      (provider.wallet as anchor.Wallet).payer,
      usdcMint,
      investorB.publicKey,
    );
    acopioUsdc = await createAssociatedTokenAccount(
      connection,
      (provider.wallet as anchor.Wallet).payer,
      usdcMint,
      acopio.publicKey,
    );

    // Fondear inversores y acopio con USDC de prueba
    await mintTo(
      connection,
      (provider.wallet as anchor.Wallet).payer,
      usdcMint,
      investorAUsdc,
      provider.wallet.publicKey,
      100_000_000_000, // 100k USDC
    );
    await mintTo(
      connection,
      (provider.wallet as anchor.Wallet).payer,
      usdcMint,
      investorBUsdc,
      provider.wallet.publicKey,
      100_000_000_000,
    );
    await mintTo(
      connection,
      (provider.wallet as anchor.Wallet).payer,
      usdcMint,
      acopioUsdc,
      provider.wallet.publicKey,
      200_000_000_000, // 200k para settle
    );

    // PDAs
    [campaignPda, campaignBump] = PublicKey.findProgramAddressSync(
      [CAMPAIGN_SEED, producer.publicKey.toBuffer(), toU64Le(campaignId)],
      program.programId,
    );
    [tokenMintPda] = PublicKey.findProgramAddressSync(
      [MINT_SEED, campaignPda.toBuffer()],
      program.programId,
    );
    vaultPda = getAssociatedTokenAddressSync(usdcMint, campaignPda, true);
  });

  it("create_campaign: PDAs, mint authority, vault vacío (spec §7.1)", async () => {
    await program.methods
      .createCampaign(
        campaignId,
        crop,
        season,
        tonsOffered,
        minTons,
        pricePerTon,
        saleEnd,
        settlementDate,
        acopio.publicKey,
      )
      .accountsPartial({
        producer: producer.publicKey,
        campaign: campaignPda,
        tokenMint: tokenMintPda,
        usdcMint,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([producer])
      .rpc();

    const campaign = await program.account.campaign.fetch(campaignPda);
    assert.strictEqual(campaign.producer.toBase58(), producer.publicKey.toBase58());
    assert.strictEqual(campaign.acopio.toBase58(), acopio.publicKey.toBase58());
    assert.strictEqual(campaign.tonsOffered.toString(), "300");
    assert.strictEqual(campaign.minTons.toString(), "200");
    assert.strictEqual(campaign.pricePerTon.toString(), "250000000");
    assert.strictEqual(campaign.tonsSold.toString(), "0");
    assert.deepEqual(campaign.status, { open: {} });
    assert.strictEqual(campaign.bump, campaignBump);

    const mintInfo = await getMint(connection, tokenMintPda);
    assert.strictEqual(mintInfo.mintAuthority?.toBase58(), campaignPda.toBase58());
    assert.strictEqual(mintInfo.decimals, 0);
    assert.strictEqual(mintInfo.supply.toString(), "0");

    const vaultInfo = await getAccount(connection, vaultPda);
    assert.strictEqual(vaultInfo.owner.toBase58(), campaignPda.toBase58());
    assert.strictEqual(vaultInfo.mint.toBase58(), usdcMint.toBase58());
    assert.strictEqual(vaultInfo.amount.toString(), "0");
  });

  it("invest: A compra 100, B compra 200 (spec §7.2)", async () => {
    const investorAToken = getAssociatedTokenAddressSync(
      tokenMintPda,
      investorA.publicKey,
    );
    const investorBToken = getAssociatedTokenAddressSync(
      tokenMintPda,
      investorB.publicKey,
    );

    await program.methods
      .invest(new BN(100))
      .accountsPartial({
        investor: investorA.publicKey,
        campaign: campaignPda,
        tokenMint: tokenMintPda,
        vault: vaultPda,
        investorUsdc: investorAUsdc,
        investorToken: investorAToken,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([investorA])
      .rpc();

    await program.methods
      .invest(new BN(200))
      .accountsPartial({
        investor: investorB.publicKey,
        campaign: campaignPda,
        tokenMint: tokenMintPda,
        vault: vaultPda,
        investorUsdc: investorBUsdc,
        investorToken: investorBToken,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([investorB])
      .rpc();

    const campaign = await program.account.campaign.fetch(campaignPda);
    assert.strictEqual(campaign.tonsSold.toString(), "300");

    const vault = await getAccount(connection, vaultPda);
    assert.strictEqual(vault.amount.toString(), "75000000000"); // 300 * 250 USDC micro

    const mint = await getMint(connection, tokenMintPda);
    assert.strictEqual(mint.supply.toString(), "300");

    const aTok = await getAccount(connection, investorAToken);
    assert.strictEqual(aTok.amount.toString(), "100");
    const bTok = await getAccount(connection, investorBToken);
    assert.strictEqual(bTok.amount.toString(), "200");
  });

  it("invest: excede cupo → ExceedsOffer", async () => {
    const investorAToken = getAssociatedTokenAddressSync(
      tokenMintPda,
      investorA.publicKey,
    );
    try {
      await program.methods
        .invest(new BN(1))
        .accountsPartial({
          investor: investorA.publicKey,
          campaign: campaignPda,
          tokenMint: tokenMintPda,
          vault: vaultPda,
          investorUsdc: investorAUsdc,
          investorToken: investorAToken,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([investorA])
        .rpc();
      assert.fail("Debía revertir ExceedsOffer");
    } catch (err: any) {
      expect(err.error?.errorCode?.code).to.equal("ExceedsOffer");
    }
  });

  it("release_funds: firmado por otro → Unauthorized", async () => {
    try {
      await program.methods
        .releaseFunds()
        .accountsPartial({
          producer: investorA.publicKey,
          campaign: campaignPda,
          vault: vaultPda,
          producerUsdc: producerUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([investorA])
        .rpc();
      assert.fail("Debía revertir Unauthorized");
    } catch (err: any) {
      // has_one falla antes de nuestro require: código puede ser Unauthorized o ConstraintHasOne.
      const code = err.error?.errorCode?.code;
      expect(["Unauthorized", "ConstraintHasOne"]).to.include(code);
    }
  });

  it("release_funds: happy path, vault → productor (spec §7.3)", async () => {
    await program.methods
      .releaseFunds()
      .accountsPartial({
        producer: producer.publicKey,
        campaign: campaignPda,
        vault: vaultPda,
        producerUsdc: producerUsdc,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([producer])
      .rpc();

    const vault = await getAccount(connection, vaultPda);
    assert.strictEqual(vault.amount.toString(), "0");

    const prodBal = await getAccount(connection, producerUsdc);
    assert.strictEqual(prodBal.amount.toString(), "75000000000");

    const campaign = await program.account.campaign.fetch(campaignPda);
    assert.deepEqual(campaign.status, { funded: {} });
  });

  it("release_funds/invest después de Funded → CampaignNotOpen", async () => {
    const investorAToken = getAssociatedTokenAddressSync(
      tokenMintPda,
      investorA.publicKey,
    );
    try {
      await program.methods
        .invest(new BN(1))
        .accountsPartial({
          investor: investorA.publicKey,
          campaign: campaignPda,
          tokenMint: tokenMintPda,
          vault: vaultPda,
          investorUsdc: investorAUsdc,
          investorToken: investorAToken,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([investorA])
        .rpc();
      assert.fail("Debía revertir CampaignNotOpen");
    } catch (err: any) {
      expect(err.error?.errorCode?.code).to.equal("CampaignNotOpen");
    }
  });

  it("settle: antes de settlement_date → TooEarly", async () => {
    try {
      await program.methods
        .settle(new BN(300), new BN(310_000_000))
        .accountsPartial({
          acopio: acopio.publicKey,
          campaign: campaignPda,
          vault: vaultPda,
          acopioUsdc: acopioUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([acopio])
        .rpc();
      assert.fail("Debía revertir TooEarly");
    } catch (err: any) {
      expect(err.error?.errorCode?.code).to.equal("TooEarly");
    }
  });

  it("settle: firmado por productor → Unauthorized", async () => {
    // Esperamos a que pase settlement_date así el fallo es por auth y no por TooEarly.
    const nowMs = Date.now();
    const targetMs = settlementDate.toNumber() * 1000 + 2000;
    if (nowMs < targetMs) {
      await new Promise((r) => setTimeout(r, targetMs - nowMs));
    }
    try {
      await program.methods
        .settle(new BN(300), new BN(310_000_000))
        .accountsPartial({
          acopio: producer.publicKey,
          campaign: campaignPda,
          vault: vaultPda,
          acopioUsdc: producerUsdc, // truco: no importa, has_one falla antes
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([producer])
        .rpc();
      assert.fail("Debía revertir Unauthorized");
    } catch (err: any) {
      const code = err.error?.errorCode?.code;
      expect(["Unauthorized", "ConstraintHasOne"]).to.include(code);
    }
  });

  it("settle: tons_delivered > tons_sold → InvalidDelivery", async () => {
    try {
      await program.methods
        .settle(new BN(301), new BN(310_000_000))
        .accountsPartial({
          acopio: acopio.publicKey,
          campaign: campaignPda,
          vault: vaultPda,
          acopioUsdc: acopioUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([acopio])
        .rpc();
      assert.fail("Debía revertir InvalidDelivery");
    } catch (err: any) {
      expect(err.error?.errorCode?.code).to.equal("InvalidDelivery");
    }
  });

  it("settle: happy path 300 tn @ 310 USDC (spec §7.4)", async () => {
    await program.methods
      .settle(new BN(300), new BN(310_000_000))
      .accountsPartial({
        acopio: acopio.publicKey,
        campaign: campaignPda,
        vault: vaultPda,
        acopioUsdc: acopioUsdc,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([acopio])
      .rpc();

    const vault = await getAccount(connection, vaultPda);
    assert.strictEqual(vault.amount.toString(), "93000000000"); // 300 * 310 USDC micro

    const campaign = await program.account.campaign.fetch(campaignPda);
    assert.deepEqual(campaign.status, { settled: {} });
    assert.strictEqual(campaign.payoutPerToken.toString(), "310000000");
    assert.strictEqual(campaign.tonsDelivered.toString(), "300");
    assert.strictEqual(campaign.settlementPrice.toString(), "310000000");
  });

  it("redeem: A redime 100 y B redime 200 (spec §7.5)", async () => {
    const investorAToken = getAssociatedTokenAddressSync(
      tokenMintPda,
      investorA.publicKey,
    );
    const investorBToken = getAssociatedTokenAddressSync(
      tokenMintPda,
      investorB.publicKey,
    );

    // A: 100 tokens → 31.000 USDC (100 * 310)
    const aUsdcBefore = (await getAccount(connection, investorAUsdc)).amount;
    await program.methods
      .redeem(new BN(100))
      .accountsPartial({
        holder: investorA.publicKey,
        campaign: campaignPda,
        tokenMint: tokenMintPda,
        vault: vaultPda,
        holderToken: investorAToken,
        holderUsdc: investorAUsdc,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([investorA])
      .rpc();

    const aUsdcAfter = (await getAccount(connection, investorAUsdc)).amount;
    assert.strictEqual(
      (aUsdcAfter - aUsdcBefore).toString(),
      "31000000000",
    );

    let mint = await getMint(connection, tokenMintPda);
    assert.strictEqual(mint.supply.toString(), "200");

    // B: 200 tokens → 62.000 USDC
    const bUsdcBefore = (await getAccount(connection, investorBUsdc)).amount;
    await program.methods
      .redeem(new BN(200))
      .accountsPartial({
        holder: investorB.publicKey,
        campaign: campaignPda,
        tokenMint: tokenMintPda,
        vault: vaultPda,
        holderToken: investorBToken,
        holderUsdc: investorBUsdc,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([investorB])
      .rpc();

    const bUsdcAfter = (await getAccount(connection, investorBUsdc)).amount;
    assert.strictEqual(
      (bUsdcAfter - bUsdcBefore).toString(),
      "62000000000",
    );

    mint = await getMint(connection, tokenMintPda);
    assert.strictEqual(mint.supply.toString(), "0");

    const vault = await getAccount(connection, vaultPda);
    assert.strictEqual(vault.amount.toString(), "0");
  });

  describe("escenario sequía (spec §7 pie)", () => {
    const droughtId = new BN(2);
    let droughtCampaign: PublicKey;
    let droughtMint: PublicKey;
    let droughtVault: PublicKey;
    let droughtBump: number;

    it("crear + full invest + release + settle con delivery parcial", async () => {
      [droughtCampaign, droughtBump] = PublicKey.findProgramAddressSync(
        [CAMPAIGN_SEED, producer.publicKey.toBuffer(), toU64Le(droughtId)],
        program.programId,
      );
      [droughtMint] = PublicKey.findProgramAddressSync(
        [MINT_SEED, droughtCampaign.toBuffer()],
        program.programId,
      );
      droughtVault = getAssociatedTokenAddressSync(usdcMint, droughtCampaign, true);

      const now2 = Math.floor(Date.now() / 1000);
      const saleEnd2 = new BN(now2 + 30);
      const settlementDate2 = new BN(now2 + 40);

      await program.methods
        .createCampaign(
          droughtId,
          crop,
          season,
          tonsOffered,
          minTons,
          pricePerTon,
          saleEnd2,
          settlementDate2,
          acopio.publicKey,
        )
        .accountsPartial({
          producer: producer.publicKey,
          campaign: droughtCampaign,
          tokenMint: droughtMint,
          usdcMint,
          vault: droughtVault,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([producer])
        .rpc();

      // A compra 300 completas para simplificar
      const aToken = getAssociatedTokenAddressSync(droughtMint, investorA.publicKey);
      await program.methods
        .invest(new BN(300))
        .accountsPartial({
          investor: investorA.publicKey,
          campaign: droughtCampaign,
          tokenMint: droughtMint,
          vault: droughtVault,
          investorUsdc: investorAUsdc,
          investorToken: aToken,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([investorA])
        .rpc();

      await program.methods
        .releaseFunds()
        .accountsPartial({
          producer: producer.publicKey,
          campaign: droughtCampaign,
          vault: droughtVault,
          producerUsdc: producerUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([producer])
        .rpc();

      // Sleep hasta settlement_date2
      const nowMs = Date.now();
      const targetMs = settlementDate2.toNumber() * 1000 + 2000;
      if (nowMs < targetMs) {
        await new Promise((r) => setTimeout(r, targetMs - nowMs));
      }

      // Settle con solo 250 entregadas @ 310
      await program.methods
        .settle(new BN(250), new BN(310_000_000))
        .accountsPartial({
          acopio: acopio.publicKey,
          campaign: droughtCampaign,
          vault: droughtVault,
          acopioUsdc: acopioUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([acopio])
        .rpc();

      const campaign = await program.account.campaign.fetch(droughtCampaign);
      // deposit = 250 * 310 = 77.500 USDC (7.75 * 10^10 micro)
      const vault = await getAccount(connection, droughtVault);
      assert.strictEqual(vault.amount.toString(), "77500000000");

      // payout_per_token = 77_500_000_000 / 300 = 258_333_333 (división entera)
      assert.strictEqual(campaign.payoutPerToken.toString(), "258333333");
    });

    it("A redime 300 → cobra 300*258333333, polvo queda en vault", async () => {
      const aToken = getAssociatedTokenAddressSync(droughtMint, investorA.publicKey);
      const before = (await getAccount(connection, investorAUsdc)).amount;
      await program.methods
        .redeem(new BN(300))
        .accountsPartial({
          holder: investorA.publicKey,
          campaign: droughtCampaign,
          tokenMint: droughtMint,
          vault: droughtVault,
          holderToken: aToken,
          holderUsdc: investorAUsdc,
          usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([investorA])
        .rpc();
      const after = (await getAccount(connection, investorAUsdc)).amount;
      // 300 * 258_333_333 = 77_499_999_900
      assert.strictEqual((after - before).toString(), "77499999900");

      // Polvo: 77_500_000_000 - 77_499_999_900 = 100 (redondeo)
      const vault = await getAccount(connection, droughtVault);
      assert.strictEqual(vault.amount.toString(), "100");
    });
  });
});
