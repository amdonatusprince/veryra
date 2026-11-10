use super::*;
use crate::types::Tier;
use near_contract_standards::non_fungible_token::approval::NonFungibleTokenApproval;
use near_contract_standards::non_fungible_token::core::{NonFungibleTokenCore, NonFungibleTokenResolver};
use near_contract_standards::non_fungible_token::enumeration::NonFungibleTokenEnumeration;
use near_contract_standards::non_fungible_token::metadata::{NFT_METADATA_SPEC, NonFungibleTokenMetadataProvider};
use near_sdk::json_types::U128;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{env, testing_env, Gas, NearToken, PromiseOrValue};

fn account(name: &str) -> AccountId {
        name.parse().unwrap()
    }

    fn yocto(whole: u128) -> u128 {
        whole * 10u128.pow(24)
    }

    fn near_deposit(whole: u128) -> NearToken {
        NearToken::from_yoctonear(yocto(whole))
    }

    fn sample_tiers() -> Vec<Tier> {
        vec![
            Tier {
                id: "silver".into(),
                name: "Silver".into(),
                xp_threshold: 0,
                revenue_share_bps: 0,
                access_rights: vec!["events".into()],
            },
            Tier {
                id: "gold".into(),
                name: "Gold".into(),
                xp_threshold: 100,
                revenue_share_bps: 1_000,
                access_rights: vec!["events".into(), "dinner".into()],
            },
        ]
    }

    fn setup() -> (Veyra, VMContextBuilder) {
        let mut context = VMContextBuilder::new();
        let owner = account("protocol.near");
        context
            .current_account_id(account("veyra.test.near"))
            .signer_account_id(owner.clone())
            .predecessor_account_id(owner.clone())
            .account_balance(near_deposit(1_000))
            .prepaid_gas(Gas::from_tgas(300));
        testing_env!(context.build());
        let contract = Veyra::new_default_meta(owner);
        (contract, context)
    }

    fn as_user(context: &mut VMContextBuilder, user: &AccountId, deposit: NearToken) {
        testing_env!(
            context
                .storage_usage(env::storage_usage())
                .predecessor_account_id(user.clone())
                .signer_account_id(user.clone())
                .attached_deposit(deposit)
                .account_balance(near_deposit(1_000))
                .prepaid_gas(Gas::from_tgas(300))
                .is_view(false)
                .build()
        );
    }

    fn create_harbour(contract: &mut Veyra, context: &mut VMContextBuilder) {
        let biz = account("restaurant.near");
        as_user(context, &biz, near_deposit(1));
        contract.create_program("harbour".into(), "Harbour".into(), "HRB".into(), sample_tiers());
    }

    #[test]
    fn initializes_and_exposes_metadata() {
        let (contract, _) = setup();
        assert_eq!(contract.get_protocol_owner(), account("protocol.near"));
        let metadata = contract.nft_metadata();
        assert_eq!(metadata.spec, NFT_METADATA_SPEC);
        assert_eq!(metadata.symbol, "VEYRA");
        assert_eq!(contract.nft_total_supply(), U128(0));
        assert!(contract.get_program("harbour".into()).is_none());
        let accounting = contract.get_accounting();
        assert_eq!(accounting.programmes, 0);
        assert_eq!(accounting.vaults, U128(0));
    }

    #[test]
    fn killer_demo_transfers_the_economic_relationship() {
        let (mut contract, mut context) = setup();
        let biz = account("restaurant.near");
        let alice = account("alice.near");
        let bob = account("bob.near");
        let carol = account("carol.near");

        create_harbour(&mut contract, &mut context);

        as_user(&mut context, &biz, NearToken::from_yoctonear(0));
        contract.update_program("harbour".into(), "Harbour Club".into(), "HRBR".into());
        as_user(&mut context, &biz, near_deposit(1));
        let configured = contract.configure_tiers(
            "harbour".into(),
            vec![
                Tier {
                    id: "silver".into(),
                    name: "Member".into(),
                    xp_threshold: 0,
                    revenue_share_bps: 0,
                    access_rights: vec!["events".into()],
                },
                Tier {
                    id: "gold".into(),
                    name: "Gold".into(),
                    xp_threshold: 100,
                    revenue_share_bps: 1_000,
                    access_rights: vec!["events".into(), "dinner".into(), "cellar".into()],
                },
            ],
        );
        assert_eq!(configured.name, "Harbour Club");
        assert_eq!(configured.tiers[0].name, "Member");

        as_user(&mut context, &biz, near_deposit(1));
        let alice_membership = contract.issue_membership(
            "harbour".into(),
            alice.clone(),
            None,
            Some("Gold card".into()),
            None,
        );
        assert_eq!(alice_membership.token_id, "m1");
        assert_eq!(alice_membership.owner_id, alice);
        assert_eq!(alice_membership.tier_id, "silver");
        assert_eq!(alice_membership.bound_account, account("m1.veyra.test.near"));
        assert_eq!(alice_membership.vault, U128(0));

        as_user(&mut context, &biz, NearToken::from_yoctonear(0));
        let bound_again = contract.bind_account("m1".into());
        assert_eq!(bound_again.bound_account, alice_membership.bound_account);
        assert_eq!(bound_again.controller, alice);

        as_user(&mut context, &biz, near_deposit(1));
        let bob_membership = contract.issue_membership(
            "harbour".into(),
            bob.clone(),
            Some("silver".into()),
            None,
            None,
        );
        assert_eq!(bob_membership.token_id, "m2");

        as_user(&mut context, &biz, near_deposit(10));
        let funded = contract.fund_membership("m1".into());
        assert_eq!(funded.vault, U128(yocto(10)));

        as_user(&mut context, &biz, near_deposit(5));
        let rewards = contract.fund_rewards("harbour".into());
        assert_eq!(rewards.reward_pool, U128(yocto(5)));

        as_user(&mut context, &biz, NearToken::from_yoctonear(0));
        let awarded = contract.award_points("m1".into(), 100, Some("dinner".into()));
        assert_eq!(awarded.tier_id, "gold");
        assert_eq!(awarded.xp, 100);
        assert_eq!(awarded.points, 100);
        assert!(awarded.access_rights.iter().any(|right| right == "cellar"));

        as_user(&mut context, &alice, NearToken::from_yoctonear(0));
        let gifted = contract.gift_points("m1".into(), "m2".into(), 20, Some("welcome".into()));
        assert_eq!(gifted.points, 80);
        assert_eq!(gifted.xp, 100);
        let bob_after_gift = contract.get_membership("m2".into()).unwrap();
        assert_eq!(bob_after_gift.points, 20);
        assert_eq!(bob_after_gift.xp, 0);

        as_user(&mut context, &biz, NearToken::from_yoctonear(0));
        let revoked = contract.revoke_points("m2".into(), 5, Some("adjustment".into()));
        assert_eq!(revoked.points, 15);

        let rewarded = contract.distribute_reward("harbour".into(), "m1".into(), U128(yocto(2)));
        assert_eq!(rewarded.vault, U128(yocto(12)));

        as_user(&mut context, &biz, near_deposit(10));
        let recorded = contract.record_revenue("harbour".into());
        assert_eq!(recorded.revenue_pool, U128(yocto(10)));
        as_user(&mut context, &biz, NearToken::from_yoctonear(0));
        let shared = contract.distribute_revenue("harbour".into());
        assert_eq!(shared.revenue_pool, U128(yocto(9)));
        let alice_after_revenue = contract.get_account("m1".into());
        assert_eq!(alice_after_revenue.vault, U128(yocto(13)));
        assert_eq!(contract.get_account("m2".into()).vault, U128(0));

        assert!(contract.verify_membership(alice.clone(), "harbour".into(), Some("dinner".into())));
        assert!(!contract.verify_membership(bob.clone(), "harbour".into(), Some("dinner".into())));
        assert!(contract.verify_membership(bob.clone(), "harbour".into(), Some("events".into())));
        assert!(contract.check_access("m1".into(), "cellar".into()));
        assert_eq!(contract.get_access_rights("m1".into()).len(), 3);

        as_user(&mut context, &alice, NearToken::from_millinear(20));
        contract.nft_approve("m1".into(), carol.clone(), None);
        assert!(contract.nft_is_approved("m1".into(), carol.clone(), Some(1)));
        as_user(&mut context, &alice, NearToken::from_yoctonear(1));
        contract.nft_revoke("m1".into(), carol.clone());
        assert!(!contract.nft_is_approved("m1".into(), carol.clone(), None));
        as_user(&mut context, &alice, NearToken::from_millinear(20));
        contract.nft_approve("m1".into(), carol.clone(), None);
        as_user(&mut context, &alice, NearToken::from_yoctonear(1));
        contract.nft_revoke_all("m1".into());
        assert!(!contract.nft_is_approved("m1".into(), carol.clone(), Some(1)));

        assert_eq!(contract.list_programs(None, None).len(), 1);
        assert_eq!(contract.memberships_for_program("harbour".into()).len(), 2);
        assert_eq!(contract.list_memberships(None, Some(10)).len(), 2);
        assert_eq!(contract.memberships_for_owner(alice.clone()).len(), 1);
        assert_eq!(contract.nft_supply_for_owner(alice.clone()), U128(1));
        assert_eq!(contract.nft_tokens(None, Some(10)).len(), 2);
        assert_eq!(contract.nft_token("m1".into()).unwrap().owner_id, alice);
        let token = contract.nft_tokens_for_owner(alice.clone(), None, None);
        assert_eq!(token[0].metadata.as_ref().unwrap().extra.as_deref().unwrap().contains("gold"), true);

        let history = contract.get_membership_history("m1".into());
        let kinds: Vec<_> = history.iter().map(|item| item.kind.as_str()).collect();
        for kind in ["issued", "bound", "funded", "points_awarded", "tier_changed", "points_gifted", "reward_distributed", "revenue_distributed"] {
            assert!(kinds.contains(&kind), "missing {kind} in {kinds:?}");
        }
        assert!(contract.get_program_history("harbour".into()).len() >= 4);
        let bob_history = contract.get_membership_history("m2".into());
        assert!(bob_history.iter().any(|item| item.kind == "points_received"));
        assert!(bob_history.iter().any(|item| item.kind == "points_revoked"));

        as_user(&mut context, &biz, NearToken::from_yoctonear(0));
        assert!(contract.pause_program("harbour".into()).paused);
        assert!(!contract.verify_membership(alice.clone(), "harbour".into(), None));
        assert!(!contract.check_access("m1".into(), "dinner".into()));
        contract.resume_program("harbour".into());
        assert!(contract.verify_membership(alice.clone(), "harbour".into(), Some("dinner".into())));

        let vault_before = contract.get_account("m1".into()).vault;
        as_user(&mut context, &alice, NearToken::from_yoctonear(1));
        contract.transfer_membership(bob.clone(), "m1".into(), Some("sale".into()));
        let moved = contract.get_account("m1".into());
        assert_eq!(moved.controller, bob);
        assert_eq!(moved.vault, vault_before);
        assert_eq!(moved.bound_account, account("m1.veyra.test.near"));
        assert_eq!(contract.nft_token("m1".into()).unwrap().owner_id, bob);
        assert!(!contract.nft_is_approved("m1".into(), carol, None));
        assert!(contract.memberships_for_owner(alice.clone()).is_empty());
        assert_eq!(contract.memberships_for_owner(bob.clone()).len(), 2);
        let transfer = contract.get_membership_history("m1".into()).last().unwrap().clone();
        assert_eq!(transfer.kind, "transferred");
        assert_eq!(transfer.counterpart.unwrap(), bob);

        as_user(&mut context, &bob, NearToken::from_yoctonear(1));
        let emptied = contract.withdraw("m1".into(), vault_before);
        assert_eq!(emptied.vault, U128(0));
        let accounting = contract.get_accounting();
        assert_eq!(accounting.programmes, 1);
        assert_eq!(accounting.memberships, 2);
        assert_eq!(accounting.reward_pool, U128(yocto(3)));
        assert_eq!(accounting.revenue_pool, U128(yocto(9)));
        assert_eq!(accounting.vaults, U128(0));
        assert!(
            contract
                .get_membership_history("m1".into())
                .iter()
                .any(|item| item.kind == "withdrawn" && item.actor == bob)
        );
    }

    #[test]
    fn transfer_call_reverts_without_moving_the_vault() {
        let (mut contract, mut context) = setup();
        create_harbour(&mut contract, &mut context);
        let biz = account("restaurant.near");
        let alice = account("alice.near");
        let bob = account("bob.near");
        as_user(&mut context, &biz, near_deposit(1));
        contract.issue_membership("harbour".into(), alice.clone(), None, None, None);
        as_user(&mut context, &biz, near_deposit(4));
        contract.fund_membership("m1".into());

        as_user(&mut context, &alice, NearToken::from_yoctonear(1));
        let result = contract.nft_transfer_call(bob.clone(), "m1".into(), None, None, "{}".into());
        assert!(matches!(result, PromiseOrValue::Promise(_)));
        assert_eq!(contract.get_account("m1".into()).controller, bob);
        assert_eq!(contract.get_account("m1".into()).vault, U128(yocto(4)));

        let contract_id = account("veyra.test.near");
        let ctx = context
            .storage_usage(env::storage_usage())
            .predecessor_account_id(contract_id.clone())
            .signer_account_id(contract_id)
            .attached_deposit(NearToken::from_yoctonear(0))
            .account_balance(near_deposit(1_000))
            .prepaid_gas(Gas::from_tgas(300))
            .is_view(false)
            .build();
        testing_env!(
            ctx,
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            std::collections::HashMap::<String, NearToken>::new(),
            vec![near_sdk::PromiseResult::Successful(
                near_sdk::serde_json::to_vec(&true).unwrap(),
            )],
        );
        let kept = contract.nft_resolve_transfer(alice.clone(), bob, "m1".into(), None);
        assert!(!kept);
        let restored = contract.get_account("m1".into());
        assert_eq!(restored.controller, alice);
        assert_eq!(restored.vault, U128(yocto(4)));
        assert_eq!(
            contract.get_membership_history("m1".into()).last().unwrap().kind,
            "transfer_reverted"
        );
    }

    #[test]
    fn changing_a_threshold_moves_the_tier() {
        let (mut contract, mut context) = setup();
        create_harbour(&mut contract, &mut context);
        let biz = account("restaurant.near");
        as_user(&mut context, &biz, near_deposit(1));
        contract.issue_membership("harbour".into(), account("alice.near"), None, None, None);
        as_user(&mut context, &biz, NearToken::from_yoctonear(0));
        contract.award_points("m1".into(), 100, None);
        assert_eq!(contract.get_membership("m1".into()).unwrap().tier_id, "gold");

        as_user(&mut context, &biz, near_deposit(1));
        contract.configure_tiers(
            "harbour".into(),
            vec![
                Tier {
                    id: "silver".into(),
                    name: "Member".into(),
                    xp_threshold: 0,
                    revenue_share_bps: 0,
                    access_rights: vec!["events".into()],
                },
                Tier {
                    id: "gold".into(),
                    name: "Gold".into(),
                    xp_threshold: 500,
                    revenue_share_bps: 1_000,
                    access_rights: vec!["dinner".into()],
                },
            ],
        );
        let membership = contract.get_membership("m1".into()).unwrap();
        assert_eq!(membership.tier_id, "silver");
        assert_eq!(membership.xp_to_next, Some(400));
        assert!(!contract.check_access("m1".into(), "dinner".into()));
    }

    #[test]
    #[should_panic(expected = "Only the current owner")]
    fn previous_owner_cannot_withdraw() {
        let (mut contract, mut context) = setup();
        create_harbour(&mut contract, &mut context);
        let biz = account("restaurant.near");
        let alice = account("alice.near");
        let bob = account("bob.near");
        as_user(&mut context, &biz, near_deposit(1));
        contract.issue_membership("harbour".into(), alice.clone(), None, None, None);
        as_user(&mut context, &biz, near_deposit(10));
        contract.fund_membership("m1".into());
        as_user(&mut context, &alice, NearToken::from_yoctonear(1));
        contract.nft_transfer(bob, "m1".into(), None, None);
        as_user(&mut context, &alice, NearToken::from_yoctonear(1));
        contract.withdraw("m1".into(), U128(yocto(10)));
    }

    #[test]
    #[should_panic(expected = "Sender not approved")]
    fn cleared_approval_cannot_transfer() {
        let (mut contract, mut context) = setup();
        create_harbour(&mut contract, &mut context);
        let biz = account("restaurant.near");
        let alice = account("alice.near");
        let bob = account("bob.near");
        let carol = account("carol.near");
        as_user(&mut context, &biz, near_deposit(1));
        contract.issue_membership("harbour".into(), alice.clone(), None, None, None);
        as_user(&mut context, &alice, NearToken::from_millinear(20));
        contract.nft_approve("m1".into(), carol.clone(), None);
        as_user(&mut context, &alice, NearToken::from_yoctonear(1));
        contract.nft_transfer(bob, "m1".into(), None, None);
        as_user(&mut context, &carol, NearToken::from_yoctonear(1));
        contract.nft_transfer(alice, "m1".into(), None, None);
    }

    #[test]
    #[should_panic(expected = "Only the programme owner")]
    fn stranger_cannot_award_points() {
        let (mut contract, mut context) = setup();
        create_harbour(&mut contract, &mut context);
        let biz = account("restaurant.near");
        as_user(&mut context, &biz, near_deposit(1));
        contract.issue_membership("harbour".into(), account("alice.near"), None, None, None);
        as_user(&mut context, &account("alice.near"), NearToken::from_yoctonear(0));
        contract.award_points("m1".into(), 5, None);
    }

    #[test]
    #[should_panic(expected = "Programme is paused")]
    fn paused_programme_rejects_rewards() {
        let (mut contract, mut context) = setup();
        create_harbour(&mut contract, &mut context);
        let biz = account("restaurant.near");
        as_user(&mut context, &biz, near_deposit(1));
        contract.issue_membership("harbour".into(), account("alice.near"), None, None, None);
        as_user(&mut context, &biz, NearToken::from_yoctonear(0));
        contract.pause_program("harbour".into());
        contract.award_points("m1".into(), 5, None);
    }

    #[test]
    #[should_panic(expected = "Insufficient reward pool")]
    fn cannot_distribute_more_than_the_pool() {
        let (mut contract, mut context) = setup();
        create_harbour(&mut contract, &mut context);
        let biz = account("restaurant.near");
        as_user(&mut context, &biz, near_deposit(1));
        contract.issue_membership("harbour".into(), account("alice.near"), None, None, None);
        as_user(&mut context, &biz, near_deposit(1));
        contract.fund_rewards("harbour".into());
        as_user(&mut context, &biz, NearToken::from_yoctonear(0));
        contract.distribute_reward("harbour".into(), "m1".into(), U128(yocto(2)));
    }

    #[test]
    #[should_panic(expected = "Insufficient vault")]
    fn cannot_withdraw_more_than_the_vault() {
        let (mut contract, mut context) = setup();
        create_harbour(&mut contract, &mut context);
        let biz = account("restaurant.near");
        let alice = account("alice.near");
        as_user(&mut context, &biz, near_deposit(1));
        contract.issue_membership("harbour".into(), alice.clone(), None, None, None);
        as_user(&mut context, &biz, near_deposit(1));
        contract.fund_membership("m1".into());
        as_user(&mut context, &alice, NearToken::from_yoctonear(1));
        contract.withdraw("m1".into(), U128(yocto(2)));
    }

    #[test]
    #[should_panic(expected = "Memberships must belong to the same programme")]
    fn cannot_gift_across_programmes() {
        let (mut contract, mut context) = setup();
        create_harbour(&mut contract, &mut context);
        let biz = account("restaurant.near");
        as_user(&mut context, &biz, near_deposit(1));
        contract.create_program("atelier".into(), "Atelier".into(), "ATL".into(), sample_tiers());
        as_user(&mut context, &biz, near_deposit(1));
        contract.issue_membership("harbour".into(), account("alice.near"), None, None, None);
        as_user(&mut context, &biz, near_deposit(1));
        contract.issue_membership("atelier".into(), account("alice.near"), None, None, None);
        as_user(&mut context, &biz, NearToken::from_yoctonear(0));
        contract.award_points("m1".into(), 10, None);
        as_user(&mut context, &account("alice.near"), NearToken::from_yoctonear(0));
        contract.gift_points("m1".into(), "m2".into(), 1, None);
    }

    #[test]
    #[should_panic(expected = "Cannot remove a tier that still has members")]
    fn cannot_remove_an_occupied_tier() {
        let (mut contract, mut context) = setup();
        create_harbour(&mut contract, &mut context);
        let biz = account("restaurant.near");
        as_user(&mut context, &biz, near_deposit(1));
        contract.issue_membership("harbour".into(), account("alice.near"), None, None, None);
        as_user(&mut context, &biz, near_deposit(1));
        contract.configure_tiers(
            "harbour".into(),
            vec![Tier {
                id: "gold".into(),
                name: "Gold".into(),
                xp_threshold: 0,
                revenue_share_bps: 0,
                access_rights: vec!["events".into()],
            }],
        );
    }

    #[test]
    #[should_panic(expected = "Current and next owner must differ")]
    fn cannot_transfer_to_self() {
        let (mut contract, mut context) = setup();
        create_harbour(&mut contract, &mut context);
        let biz = account("restaurant.near");
        let alice = account("alice.near");
        as_user(&mut context, &biz, near_deposit(1));
        contract.issue_membership("harbour".into(), alice.clone(), None, None, None);
        as_user(&mut context, &alice, NearToken::from_yoctonear(1));
        contract.transfer_membership(alice, "m1".into(), None);
    }

    #[test]
    fn pass_image_is_issued_and_payment_debits_the_vault() {
        let (mut contract, mut context) = setup();
        create_harbour(&mut contract, &mut context);
        let biz = account("restaurant.near");
        let alice = account("alice.near");
        let bob = account("bob.near");
        let image = "https://example.com/pass.png";

        as_user(&mut context, &biz, near_deposit(1));
        let program = contract.set_program_media("harbour".into(), image.into());
        assert_eq!(program.media.as_deref(), Some(image));

        as_user(&mut context, &biz, near_deposit(1));
        let membership = contract.issue_membership("harbour".into(), alice.clone(), None, None, None);
        assert_eq!(membership.media.as_deref(), Some(image));
        let token = contract.nft_token("m1".into()).unwrap();
        assert_eq!(token.metadata.unwrap().media.as_deref(), Some(image));
        let found = contract.find_membership("m1.veyra.test.near".into()).unwrap();
        assert_eq!(found.token_id, "m1");

        as_user(&mut context, &account("protocol.near"), NearToken::from_yoctonear(0));
        contract.set_usdc_token(account("usdc.test.near"));
        as_user(&mut context, &account("usdc.test.near"), NearToken::from_yoctonear(0));
        contract.ft_on_transfer(alice.clone(), U128(10_000_000), "vault:m1".into());
        as_user(&mut context, &alice, NearToken::from_yoctonear(1));
        let paid = contract.pay("m1".into(), bob, U128(1_000_000));
        assert_eq!(paid.usdc_vault, U128(9_000_000));
    }

    #[test]
    #[should_panic(expected = "Image address must start with https://")]
    fn programme_image_must_be_https() {
        let (mut contract, mut context) = setup();
        create_harbour(&mut contract, &mut context);
        let biz = account("restaurant.near");
        as_user(&mut context, &biz, near_deposit(1));
        contract.set_program_media("harbour".into(), "http://example.com/pass.png".into());
    }
