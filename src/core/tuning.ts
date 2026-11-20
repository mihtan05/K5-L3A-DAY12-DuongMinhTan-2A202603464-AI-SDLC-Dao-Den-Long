// Single source of truth for gameplay numbers. game.contract.json "tuning" must equal TUNING (tests/contract.test.ts).
export const TUNING = {
  player_speed: 6, // m/s
  carry_capacity: 10, // motes
  lantern_cost: 5, // motes needed to light one lantern
  lantern_count_night1: 5,
  pickup_radius: 1.0, // m, motes are picked automatically
  interact_radius: 2.5, // m, deposit range to lantern base
  pulse_cost: 2, // carried motes spent per pulse
  pulse_radius: 6, // m
  night1_duration_s: 300,
  flames: 3, // player health
  invuln_s: 2,
  hit_drop_ratio: 0.5, // floor(carried * ratio) motes lost on hit
  pulse_stun_s: 3,
  pulse_push_m: 4,
  pulse_cooldown_s: 1,
  safe_radius: 4, // around LIT lanterns, shades cannot enter
  shade_speed: 3.5, // m/s
  shade_hit_radius: 1.0,
  fall_enabled: false, // player is kept inside the island edge
  score: { per_mote: 10, per_lantern: 100, per_stun: 20, per_second_left: 1, per_flame_left: 50 },
} as const;

// Internal numbers (not part of the contract).
export const WORLD = {
  island_radius: 30,
  lantern_ring_radius: 18,
  jump_speed: 5, // m/s
  gravity: 15, // m/s^2
  shade_height: 1.0, // y of shade center for spawned shades
  motes_initial: 30,
  motes_max: 30,
  mote_respawn_s: 2,
  shades_initial: 2,
  shades_max: 5,
  shade_spawn_s: 40,
  shade_spawn_ring: 27, // spawned on this radius
};
