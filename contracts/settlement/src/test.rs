#[cfg(test)]
mod test {
    use crate::{StellarPeSettlement, StellarPeSettlementClient};
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Address, Env, String,
    };

    fn setup_env() -> (Env, Address, StellarPeSettlementClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, StellarPeSettlement);
        let client = StellarPeSettlementClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        (env, admin, client)
    }

    #[test]
    fn test_record_payment_and_balance() {
        let (env, _admin, client) = setup_env();

        let merchant_id = String::from_str(&env, "merchant_001");
        let payer = Address::generate(&env);
        let amount: i128 = 10_000_000; // 1 USDC
        let asset = String::from_str(&env, "USDC");

        // Balance starts at zero
        assert_eq!(client.get_merchant_balance(&merchant_id), 0);

        // Record a payment
        let idx = client.record_payment(&merchant_id, &payer, &amount, &asset);
        assert_eq!(idx, 0);

        // Balance should now reflect the payment
        assert_eq!(client.get_merchant_balance(&merchant_id), amount);

        // Record a second payment
        let idx2 = client.record_payment(&merchant_id, &payer, &amount, &asset);
        assert_eq!(idx2, 1);
        assert_eq!(client.get_merchant_balance(&merchant_id), amount * 2);
    }

    #[test]
    fn test_get_transaction() {
        let (env, _admin, client) = setup_env();

        let merchant_id = String::from_str(&env, "merchant_002");
        let payer = Address::generate(&env);
        let amount: i128 = 5_000_000; // 0.5 USDC
        let asset = String::from_str(&env, "USDC");

        client.record_payment(&merchant_id, &payer, &amount, &asset);

        let tx = client.get_transaction(&merchant_id, &0);
        assert_eq!(tx.amount, amount);
        assert_eq!(tx.payer, payer);
        assert_eq!(tx.settled, false);
    }

    #[test]
    fn test_mark_settled() {
        let (env, _admin, client) = setup_env();

        let merchant_id = String::from_str(&env, "merchant_003");
        let payer = Address::generate(&env);
        let amount: i128 = 20_000_000; // 2 USDC
        let asset = String::from_str(&env, "USDC");

        client.record_payment(&merchant_id, &payer, &amount, &asset);
        assert_eq!(client.get_merchant_balance(&merchant_id), amount);

        let anchor_ref = String::from_str(&env, "sep24-tx-abc123");
        client.mark_settled(&merchant_id, &amount, &anchor_ref);

        // Balance should be zero after full settlement
        assert_eq!(client.get_merchant_balance(&merchant_id), 0);
    }

    #[test]
    fn test_partial_settlement() {
        let (env, _admin, client) = setup_env();

        let merchant_id = String::from_str(&env, "merchant_004");
        let payer = Address::generate(&env);
        let amount: i128 = 30_000_000; // 3 USDC
        let asset = String::from_str(&env, "USDC");

        client.record_payment(&merchant_id, &payer, &amount, &asset);

        // Settle only 1 USDC
        let settle_amount: i128 = 10_000_000;
        let anchor_ref = String::from_str(&env, "sep24-tx-partial");
        client.mark_settled(&merchant_id, &settle_amount, &anchor_ref);

        assert_eq!(
            client.get_merchant_balance(&merchant_id),
            amount - settle_amount
        );
    }

    #[test]
    #[should_panic(expected = "amount must be positive")]
    fn test_zero_payment_rejected() {
        let (env, _admin, client) = setup_env();
        let merchant_id = String::from_str(&env, "merchant_005");
        let payer = Address::generate(&env);
        let asset = String::from_str(&env, "USDC");
        client.record_payment(&merchant_id, &payer, &0, &asset);
    }

    #[test]
    #[should_panic(expected = "insufficient unsettled balance")]
    fn test_settle_more_than_balance_rejected() {
        let (env, _admin, client) = setup_env();
        let merchant_id = String::from_str(&env, "merchant_006");
        let payer = Address::generate(&env);
        let asset = String::from_str(&env, "USDC");
        client.record_payment(&merchant_id, &payer, &10_000_000, &asset);
        let anchor_ref = String::from_str(&env, "ref");
        // Try to settle 2 USDC when only 1 is available
        client.mark_settled(&merchant_id, &20_000_000, &anchor_ref);
    }

    #[test]
    fn test_tx_count() {
        let (env, _admin, client) = setup_env();
        let merchant_id = String::from_str(&env, "merchant_007");
        let payer = Address::generate(&env);
        let asset = String::from_str(&env, "USDC");
        assert_eq!(client.get_tx_count(&merchant_id), 0);
        client.record_payment(&merchant_id, &payer, &10_000_000, &asset);
        client.record_payment(&merchant_id, &payer, &5_000_000, &asset);
        assert_eq!(client.get_tx_count(&merchant_id), 2);
    }
}
