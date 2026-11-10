#[near]
impl Veyra {
    #[payable]
    pub fn create_program(
        &mut self,
        program_id: String,
        name: String,
        symbol: String,
        tiers: Vec<Tier>,
    ) -> ProgramView {
        let start = env::storage_usage();
        let program_id = assert_slug(&program_id, "Programme id");
        require!(self.programs.get(&program_id).is_none(), "Programme id already exists");
        let name = clean_label(&name, 64, "Name");
        let symbol = clean_label(&symbol, 12, "Symbol");
        validate_tiers(&tiers);

        let mut tier_counts = BTreeMap::new();
        for tier in &tiers {
            tier_counts.insert(tier.id.clone(), 0);
        }
        let program = Program {
            id: program_id.clone(),
            owner_id: env::predecessor_account_id(),
            name,
            symbol,
            paused: false,
            tiers,
            tier_counts,
            reward_pool: 0,
            revenue_pool: 0,
            membership_count: 0,
        };
        self.programs.insert(&program_id, &program);
        self.program_tokens.insert(&program_id, &Vec::new());
        self.push_program(&program_id, "programme_created", None, None);
        self.settle_storage(start);
        self.program_view(&program)
    }

    pub fn update_program(
        &mut self,
        program_id: String,
        name: String,
        symbol: String,
    ) -> ProgramView {
        self.assert_program_owner(&program_id);
        let mut program = self.must_program(&program_id);
        program.name = clean_label(&name, 64, "Name");
        program.symbol = clean_label(&symbol, 12, "Symbol");
        self.programs.insert(&program_id, &program);
        self.push_program(&program_id, "programme_updated", None, None);
        self.program_view(&program)
    }

    pub fn pause_program(&mut self, program_id: String) -> ProgramView {
        self.assert_program_owner(&program_id);
        let mut program = self.must_program(&program_id);
        require!(!program.paused, "Programme is paused");
        program.paused = true;
        self.programs.insert(&program_id, &program);
        self.push_program(&program_id, "programme_paused", None, None);
        self.program_view(&program)
    }

    pub fn resume_program(&mut self, program_id: String) -> ProgramView {
        self.assert_program_owner(&program_id);
        let mut program = self.must_program(&program_id);
        require!(program.paused, "Programme is active");
        program.paused = false;
        self.programs.insert(&program_id, &program);
        self.push_program(&program_id, "programme_resumed", None, None);
        self.program_view(&program)
    }

    #[payable]
    pub fn configure_tiers(&mut self, program_id: String, tiers: Vec<Tier>) -> ProgramView {
        let start = env::storage_usage();
        self.assert_program_owner(&program_id);
        validate_tiers(&tiers);
        let mut program = self.must_program(&program_id);
        for (id, count) in &program.tier_counts {
            if *count > 0 && !tiers.iter().any(|tier| tier.id == *id) {
                env::panic_str("Cannot remove a tier that still has members");
            }
        }
        let mut tier_counts = BTreeMap::new();
        for tier in &tiers {
            let existing = program.tier_counts.get(&tier.id).copied().unwrap_or(0);
            tier_counts.insert(tier.id.clone(), existing);
        }
        program.tiers = tiers;
        program.tier_counts = tier_counts;
        self.programs.insert(&program_id, &program);
        self.recompute_tiers(&program_id);
        self.push_program(&program_id, "tiers_configured", None, None);
        self.settle_storage(start);
        self.program_view(&self.must_program(&program_id))
    }

    #[payable]
    pub fn set_program_color(&mut self, program_id: String, color: String) -> ProgramView {
        let start = env::storage_usage();
        self.assert_program_owner(&program_id);
        let color = color.trim().to_string();
        require!(color.len() == 7 && color.starts_with('#'), "Choose a brand color");
        require!(color.chars().skip(1).all(|char| char.is_ascii_hexdigit()), "Choose a brand color");
        self.write_program_color(&program_id, &color);
        self.push_program(&program_id, "color_set", None, Some(color));
        self.settle_storage(start);
        self.program_view(&self.must_program(&program_id))
    }

    /// Stores the programme picture outside the programme record and copies it onto every pass.
    #[payable]
    pub fn set_program_media(&mut self, program_id: String, media: String) -> ProgramView {
        let start = env::storage_usage();
        self.assert_program_owner(&program_id);
        let media = clean_media(&media);
        self.write_program_media(&program_id, &media);
        for token_id in self.program_tokens.get(&program_id).unwrap_or_default() {
            self.set_token_media(&token_id, &media);
        }
        self.push_program(&program_id, "media_set", None, Some(media));
        self.settle_storage(start);
        self.program_view(&self.must_program(&program_id))
    }

    pub fn get_program(&self, program_id: String) -> Option<ProgramView> {
        self.programs.get(&program_id).map(|program| self.program_view(&program))
    }

    pub fn list_programs(&self, from_index: Option<u64>, limit: Option<u64>) -> Vec<ProgramView> {
        let start = from_index.unwrap_or(0);
        let limit = limit.unwrap_or(50).min(50);
        self.programs
            .values()
            .skip(start as usize)
            .take(limit as usize)
            .map(|program| self.program_view(&program))
            .collect()
    }

    #[payable]
    pub fn fund_rewards(&mut self, program_id: String) -> ProgramView {
        self.assert_owner_and_active(&program_id);
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "Attach NEAR to fund rewards");
        let mut program = self.must_program(&program_id);
        program.reward_pool = program
            .reward_pool
            .checked_add(amount)
            .unwrap_or_else(|| env::panic_str("Reward pool overflow"));
        self.programs.insert(&program_id, &program);
        self.push_program(&program_id, "rewards_funded", Some(amount), None);
        self.program_view(&program)
    }
}
