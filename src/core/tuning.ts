// Single source of truth for gameplay numbers (Ticket-02 standard values, Ticket-03 changes).
// game.contract.json "tuning" must equal TUNING (tests/contract.test.ts).
export const TUNING = {
  player_speed: 6, // m/s
  carry_capacity: 10, // motes
  lantern_cost: 10, // motes needed to light one lantern
  lantern_count_night1: 5,
  pickup_radius: 1.0, // m (XZ), automatic
  interact_radius: 2.0, // m (XZ)
  pulse_cost: 3,
  pulse_radius: 5, // m (3D, from foot + 0.8 m)
  night1_duration_s: 240, // Ticket-03
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4.0,
  shade_hit_radius: 1.0,
  fall_enabled: true,
  // Ticket-03 score: +5 per mote deposited, +100 first light, time bonus removed (relight/drain/dawn bonuses in RULES)
  score: { per_mote: 5, per_lantern: 100, per_stun: 5, per_second_left: 0, per_flame_left: 50 },
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  night2_duration_s: 270,
  night3_duration_s: 300,
  fuel_max: 100,
  fuel_decay_per_s: 1.0,
  fuel_per_mote: 10,
  relight_cost: 5,
  win_ratio: 0.6,
  drain_per_s: 5,
  low_fuel_threshold: 30,
  capacity_max: 20,
} as const;

// Standard numbers from Ticket-02 that are not contract keys, in ticks / m / m/s.
export const RULES = {
  jump_speed: 7,
  gravity: 20,
  step_up: 0.3, // max climb per tick; higher is a cliff (assumption B2)
  pickup_dy: 1.5, // max height difference for pickup and shade touch
  motes_initial: 20,
  motes_max: 30,
  mote_spawn_every: 240,
  dropped_ttl: 480,
  drop_ring: [1.5, 2.5],
  pulse_center_dy: 0.8,
  pulse_push_ticks: 15,
  shade_speed_night3: 4.5,
  shade_detect: 12,
  shade_giveup: 18,
  shade_spawn_min_dist: 15,
  shade_first_spawn: 300,
  shade_height: 1.0, // shade center above ground
  shade_spawning_ticks: 60, // assumption B6
  shade_wander_speed: 2, // assumption B6
  recoil_m: 2,
  recoil_ticks: 60,
  expel_ticks: 30,
  fall_y: -10,
  respawn_wait: 60,
  drifter_speed: 7,
  drifter_idle_speed: 2,
  drifter_max: 2,
  drifter_spawn_every: 1200,
  drifter_carry_trigger: 5,
  drifter_detect: 15,
  drifter_touch: 1.2,
  drifter_steal: 3,
  drifter_flee_ticks: 240,
  drifter_drop_flee_ticks: 120,
  drifter_height: 1.5,
  charm_ticks: 600,
  charm_respawn: 2700,
  charm_speed: 7.2,
  wind_every: 1800,
  wind_ticks: 300,
  wind_warn: 120,
  wind_speed: 2,
  // Ticket-03
  capacity_per_light: 2,
  score_relight: 40,
  score_stun_draining: 15,
  score_dawn_lantern: 50,
  drain_range: 2, // m: wander shade starts draining its weak lantern
  drain_break: 6, // m: May this close makes a draining shade chase
  // Ticket-04 benchmark scene (render camera numbers live in src/render/bench.ts)
  bench_shades: 200,
  bench_motes: 100,
  bench_lit: 3, // L1..L3 lit with fuel 100
  // Ticket-04 soak input (probabilities per tick)
  soak_dir_every: 30,
  soak_p_jump: 0.05,
  soak_p_dash: 0.03,
  soak_p_pulse: 0.02,
  soak_p_interact: 0.1,
} as const;
