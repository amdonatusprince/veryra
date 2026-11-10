#[near]
impl Veyra {
    pub fn verify_membership(
        &self,
        owner_id: AccountId,
        program_id: String,
        right: Option<String>,
    ) -> bool {
        let Some(program) = self.programs.get(&program_id) else {
            return false;
        };
        if program.paused {
            return false;
        }
        let tokens = self.program_tokens.get(&program_id).unwrap_or_default();
        for token_id in tokens {
            if self.owner_of(&token_id) != owner_id {
                continue;
            }
            let Some(membership) = self.memberships.get(&token_id) else {
                continue;
            };
            let Some(right) = right.as_ref() else {
                return true;
            };
            if self.tier_of(&program, &membership.tier_id).is_some_and(|tier| {
                tier.access_rights.iter().any(|candidate| candidate == right)
            }) {
                return true;
            }
        }
        false
    }

    pub fn check_access(&self, token_id: TokenId, right: String) -> bool {
        let Some(membership) = self.memberships.get(&token_id) else {
            return false;
        };
        let Some(program) = self.programs.get(&membership.program_id) else {
            return false;
        };
        if program.paused {
            return false;
        }
        self.tier_of(&program, &membership.tier_id)
            .is_some_and(|tier| tier.access_rights.iter().any(|candidate| candidate == &right))
    }

    pub fn get_access_rights(&self, token_id: TokenId) -> Vec<String> {
        let membership = self.must_membership(&token_id);
        let program = self.must_program(&membership.program_id);
        self.tier_of(&program, &membership.tier_id)
            .map(|tier| tier.access_rights.clone())
            .unwrap_or_default()
    }

    pub fn get_membership_history(&self, token_id: TokenId) -> Vec<Activity> {
        self.history.get(&token_id).unwrap_or_default()
    }

    pub fn get_program_history(&self, program_id: String) -> Vec<Activity> {
        self.program_history.get(&program_id).unwrap_or_default()
    }

    pub fn get_accounting(&self) -> AccountingView {
        let mut reward_pool = 0u128;
        let mut revenue_pool = 0u128;
        let mut memberships = 0u64;
        for program in self.programs.values() {
            reward_pool += program.reward_pool;
            revenue_pool += program.revenue_pool;
            memberships += program.membership_count;
        }
        AccountingView {
            programmes: self.programs.len(),
            memberships,
            reward_pool: U128(reward_pool),
            revenue_pool: U128(revenue_pool),
            vaults: U128(self.total_vault),
            usdc_reward_pool: U128(read_u128(b"veyra.u.tr")),
            usdc_revenue_pool: U128(read_u128(b"veyra.u.te")),
            usdc_vaults: U128(read_u128(b"veyra.u.tv")),
        }
    }
}
