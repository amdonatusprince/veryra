#[near]
impl Veyra {
    #[payable]
    pub fn fund_membership(&mut self, token_id: TokenId) -> AccountView {
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "Attach NEAR to fund the membership");
        self.must_membership(&token_id);
        self.credit_vault(&token_id, amount, "funded");
        self.account_view(&token_id)
    }

    #[payable]
    pub fn withdraw(&mut self, token_id: TokenId, amount: U128) -> AccountView {
        assert_one_yocto();
        let amount = amount.0;
        require!(amount > 0, "Amount must be greater than zero");
        let owner = self.owner_of(&token_id);
        require!(owner == env::predecessor_account_id(), "Only the current owner");
        let mut membership = self.must_membership(&token_id);
        require!(membership.vault >= amount, "Insufficient vault");
        membership.vault -= amount;
        self.total_vault -= amount;
        self.memberships.insert(&token_id, &membership);
        self.push_history(&token_id, "withdrawn", Some(owner.clone()), Some(amount), None, None);
        Promise::new(owner).transfer(NearToken::from_yoctonear(amount)).detach();
        self.account_view(&token_id)
    }

    /// The current owner pays a counterparty in mock USDC from the pass. The pass stays with the owner.
    #[payable]
    pub fn pay(&mut self, token_id: TokenId, receiver_id: AccountId, amount: U128) -> AccountView {
        assert_one_yocto();
        let amount = amount.0;
        require!(amount > 0, "Amount must be greater than zero");
        let owner = self.owner_of(&token_id);
        require!(owner == env::predecessor_account_id(), "Only the current owner");
        require!(receiver_id != env::current_account_id(), "Choose a recipient account");
        let _ = self.usdc_token();
        self.debit_usdc_vault(&token_id, amount);
        self.push_history(&token_id, "paid", Some(receiver_id.clone()), Some(amount), None, None);
        self.transfer_usdc(receiver_id, amount);
        self.account_view(&token_id)
    }

    /// Sends mock USDC from the pass to the current owner.
    #[payable]
    pub fn cash_out(&mut self, token_id: TokenId, amount: U128) -> AccountView {
        assert_one_yocto();
        let amount = amount.0;
        require!(amount > 0, "Amount must be greater than zero");
        let owner = self.owner_of(&token_id);
        require!(owner == env::predecessor_account_id(), "Only the current owner");
        self.debit_usdc_vault(&token_id, amount);
        self.push_history(&token_id, "cashed_out", Some(owner), Some(amount), None, None);
        self.transfer_usdc(self.owner_of(&token_id), amount);
        self.account_view(&token_id)
    }

    pub fn set_usdc_token(&mut self, token_id: AccountId) {
        require!(env::predecessor_account_id() == self.tokens.owner_id, "Only the protocol owner");
        env::storage_write(b"veyra.usdc.token", token_id.as_bytes());
    }

    pub fn get_usdc_token(&self) -> Option<AccountId> {
        env::storage_read(b"veyra.usdc.token").and_then(|bytes| String::from_utf8(bytes).ok()).and_then(|value| value.parse().ok())
    }

    /// Credits mock USDC. `msg` is `vault:<token>`, `rewards:<programme>`, or `revenue:<programme>`.
    pub fn ft_on_transfer(&mut self, sender_id: AccountId, amount: U128, msg: String) -> U128 {
        require!(env::predecessor_account_id() == self.usdc_token(), "Unknown token");
        require!(amount.0 > 0, "Amount must be greater than zero");
        let (kind, id) = msg.split_once(':').unwrap_or_else(|| env::panic_str("Say where the dollars go"));
        require!(!id.is_empty(), "Say where the dollars go");
        match kind {
            "vault" => {
                self.must_membership(&id.to_string());
                self.credit_usdc_vault(&id.to_string(), amount.0);
                self.push_history(&id.to_string(), "funded", None, Some(amount.0), None, Some("mUSDC".to_string()));
            }
            "rewards" => {
                let program = self.must_program(id);
                require!(!program.paused, "Programme is paused");
                require!(program.owner_id == sender_id, "Only the programme owner");
                self.credit_usdc_pool(id, true, amount.0);
                self.push_program(id, "rewards_funded", Some(amount.0), Some("mUSDC".to_string()));
            }
            "revenue" => {
                let program = self.must_program(id);
                require!(!program.paused, "Programme is paused");
                require!(program.owner_id == sender_id, "Only the programme owner");
                self.credit_usdc_pool(id, false, amount.0);
                self.push_program(id, "revenue_recorded", Some(amount.0), Some("mUSDC".to_string()));
            }
            _ => env::panic_str("Say where the dollars go"),
        }
        U128(0)
    }

    pub fn distribute_usdc_reward(&mut self, program_id: String, token_id: TokenId, amount: U128) -> AccountView {
        self.assert_owner_and_active(&program_id);
        let amount = amount.0;
        require!(amount > 0, "Amount must be greater than zero");
        let membership = self.must_membership(&token_id);
        require!(membership.program_id == program_id, "Memberships must belong to the same programme");
        self.debit_usdc_pool(&program_id, true, amount);
        self.credit_usdc_vault(&token_id, amount);
        self.push_history(&token_id, "reward_distributed", None, Some(amount), None, Some("mUSDC".to_string()));
        self.account_view(&token_id)
    }

    pub fn get_account(&self, token_id: TokenId) -> AccountView {
        self.account_view(&token_id)
    }

    pub fn award_points(
        &mut self,
        token_id: TokenId,
        points: u64,
        memo: Option<String>,
    ) -> MembershipView {
        require!(points > 0, "Points must be greater than zero");
        let membership = self.must_membership(&token_id);
        self.assert_owner_and_active(&membership.program_id);
        self.add_points(&token_id, points, true);
        self.push_history(&token_id, "points_awarded", None, None, memo, Some(points.to_string()));
        self.sync_tier(&token_id);
        self.membership_view(&token_id).unwrap()
    }

    pub fn revoke_points(
        &mut self,
        token_id: TokenId,
        points: u64,
        memo: Option<String>,
    ) -> MembershipView {
        require!(points > 0, "Points must be greater than zero");
        let membership = self.must_membership(&token_id);
        self.assert_owner_and_active(&membership.program_id);
        let mut membership = self.must_membership(&token_id);
        require!(membership.points >= points, "Insufficient points");
        membership.points -= points;
        membership.xp = membership.xp.saturating_sub(points);
        self.memberships.insert(&token_id, &membership);
        self.push_history(&token_id, "points_revoked", None, None, memo, Some(points.to_string()));
        self.sync_tier(&token_id);
        self.membership_view(&token_id).unwrap()
    }

    /// Moves spendable points. XP, and therefore tier, stays with the sender.
    pub fn gift_points(
        &mut self,
        from_token_id: TokenId,
        to_token_id: TokenId,
        points: u64,
        memo: Option<String>,
    ) -> MembershipView {
        require!(points > 0, "Points must be greater than zero");
        require!(from_token_id != to_token_id, "Choose a different membership");
        let from = self.must_membership(&from_token_id);
        let to = self.must_membership(&to_token_id);
        require!(from.program_id == to.program_id, "Memberships must belong to the same programme");
        require!(self.owner_of(&from_token_id) == env::predecessor_account_id(), "Only the current owner");
        self.assert_active(&from.program_id);
        require!(from.points >= points, "Insufficient points");

        self.add_points(&from_token_id, points, false);
        let mut receiver = self.must_membership(&to_token_id);
        receiver.points = receiver
            .points
            .checked_add(points)
            .unwrap_or_else(|| env::panic_str("Points overflow"));
        self.memberships.insert(&to_token_id, &receiver);
        self.push_history(
            &from_token_id,
            "points_gifted",
            Some(self.owner_of(&to_token_id)),
            None,
            memo.clone(),
            Some(points.to_string()),
        );
        self.push_history(
            &to_token_id,
            "points_received",
            Some(env::predecessor_account_id()),
            None,
            memo,
            Some(points.to_string()),
        );
        self.membership_view(&from_token_id).unwrap()
    }

    pub fn distribute_reward(
        &mut self,
        program_id: String,
        token_id: TokenId,
        amount: U128,
    ) -> AccountView {
        self.assert_owner_and_active(&program_id);
        let amount = amount.0;
        require!(amount > 0, "Amount must be greater than zero");
        let membership = self.must_membership(&token_id);
        require!(membership.program_id == program_id, "Membership is not in this programme");
        let mut program = self.must_program(&program_id);
        require!(program.reward_pool >= amount, "Insufficient reward pool");
        program.reward_pool -= amount;
        self.programs.insert(&program_id, &program);
        self.credit_vault(&token_id, amount, "reward_distributed");
        self.account_view(&token_id)
    }

    #[payable]
    pub fn record_revenue(&mut self, program_id: String) -> ProgramView {
        self.assert_owner_and_active(&program_id);
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "Attach NEAR to record revenue");
        let mut program = self.must_program(&program_id);
        program.revenue_pool = program
            .revenue_pool
            .checked_add(amount)
            .unwrap_or_else(|| env::panic_str("Revenue pool overflow"));
        self.programs.insert(&program_id, &program);
        self.push_program(&program_id, "revenue_recorded", Some(amount), None);
        self.program_view(&program)
    }

    /// Splits the revenue pool by tier. Each tier's basis points are shared evenly
    /// by the memberships in that tier. Dust stays in the pool. Credits the token
    /// vault, never the owner's personal account.
    pub fn distribute_revenue(&mut self, program_id: String) -> ProgramView {
        self.assert_owner_and_active(&program_id);
        let program = self.must_program(&program_id);
        let pool = program.revenue_pool;
        require!(pool > 0, "Revenue pool is empty");
        let tokens = self.program_tokens.get(&program_id).unwrap_or_default();
        require!(!tokens.is_empty(), "No memberships to pay");

        let mut by_tier: BTreeMap<String, Vec<TokenId>> = BTreeMap::new();
        for token_id in &tokens {
            let membership = self.must_membership(token_id);
            by_tier.entry(membership.tier_id).or_default().push(token_id.clone());
        }

        let mut paid = 0u128;
        for tier in &program.tiers {
            if tier.revenue_share_bps == 0 {
                continue;
            }
            let Some(members) = by_tier.get(&tier.id) else { continue };
            if members.is_empty() {
                continue;
            }
            let share = pool.saturating_mul(u128::from(tier.revenue_share_bps)) / 10_000;
            let each = share / members.len() as u128;
            if each == 0 {
                continue;
            }
            for token_id in members {
                self.credit_vault(token_id, each, "revenue_distributed");
                paid += each;
            }
        }
        require!(paid > 0, "Nothing to distribute");
        let mut program = self.must_program(&program_id);
        program.revenue_pool -= paid;
        self.programs.insert(&program_id, &program);
        self.push_program(&program_id, "revenue_distributed", Some(paid), None);
        self.program_view(&program)
    }

    /// Same split as `distribute_revenue`, paid in mock USDC into each pass.
    pub fn distribute_usdc_revenue(&mut self, program_id: String) -> ProgramView {
        self.assert_owner_and_active(&program_id);
        let program = self.must_program(&program_id);
        let pool = self.usdc_pool(&program_id, false);
        require!(pool > 0, "Revenue pool is empty");
        let tokens = self.program_tokens.get(&program_id).unwrap_or_default();
        require!(!tokens.is_empty(), "No memberships to pay");

        let mut by_tier: BTreeMap<String, Vec<TokenId>> = BTreeMap::new();
        for token_id in &tokens {
            let membership = self.must_membership(token_id);
            by_tier.entry(membership.tier_id).or_default().push(token_id.clone());
        }

        let mut paid = 0u128;
        for tier in &program.tiers {
            if tier.revenue_share_bps == 0 {
                continue;
            }
            let Some(members) = by_tier.get(&tier.id) else { continue };
            if members.is_empty() {
                continue;
            }
            let share = pool.saturating_mul(u128::from(tier.revenue_share_bps)) / 10_000;
            let each = share / members.len() as u128;
            if each == 0 {
                continue;
            }
            for token_id in members {
                self.credit_usdc_vault(token_id, each);
                self.push_history(token_id, "revenue_distributed", None, Some(each), None, Some("mUSDC".to_string()));
                paid += each;
            }
        }
        require!(paid > 0, "Nothing to distribute");
        self.debit_usdc_pool(&program_id, false, paid);
        self.push_program(&program_id, "revenue_distributed", Some(paid), Some("mUSDC".to_string()));
        self.program_view(&self.must_program(&program_id))
    }
}
