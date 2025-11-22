# Project: MOBA Three.js (RoV/LoL Style) Development Plan

This document outlines the development phases for a browser-based MOBA game using Three.js.

## Phase 1: Alpha 0.1 - Foundation & Core Loop
**Goal:** Establish the basic game loop from character selection to spawning and basic interaction.

### 1. Character Selection UI
- **Interface:** A simple HTML/CSS overlay on top of the canvas.
- **Features:**
    - Display a list of selectable characters (initially placeholders like "Warrior", "Mage").
    - **Timer:** A 10-second countdown to auto-select or force start.
    - **Skip Button:** Button to lock in selection and start immediately.
    - **State Management:** Pass the selected character ID to the game scene.

### 2. The Map (Basic Implementation)
- **Terrain:** A flat plane or simple terrain mesh representing a standard 3-lane MOBA map layout (simplified for Alpha).
- **Base:** A designated spawn area (coordinates 0,0,0 or specific corner).
- **Camera:** Top-down isometric view (RTS style) centered on the player.

### 3. Character Control
- **Spawning:** Instantiate the selected character model at the Base.
- **Movement:** 
    - Raycasting for mouse clicks on the ground.
    - Pathfinding (NavMesh) or simple direct movement to clicked location.
- **Basic Attack:**
    - Detect enemies within range.
    - Simple animation trigger (or color change) to represent attacking.
    - Projectile generation (if ranged) or instant hit (if melee).

---

## Phase 2: Alpha 0.2 - The Living World (Minions & Structures)
**Goal:** Add the environmental elements that define a MOBA.

### 1. Minion Waves
- **Spawning Logic:** Spawn waves of minions every 30 seconds from the Base.
- **Pathing:** Minions follow predefined paths down the lanes.
- **AI:** Simple state machine: Move -> Detect Enemy -> Attack -> Die.

### 2. Towers (Turrets)
- **Placement:** Place towers at strategic points along the lanes.
- **Logic:** 
    - Target priority (Minions > Players).
    - Aggro switching (if player attacks allied hero under tower).
    - Health and destruction mechanics.

---

## Phase 3: Alpha 0.3 - Combat System & Stats
**Goal:** Deepen the gameplay with RPG elements.

### 1. Stats System
- Health, Mana, Attack Damage, Attack Speed, Movement Speed, Armor, Magic Resist.
- Health bars (UI billboards above units).

### 2. Abilities (Q, W, E, R)
- **Skill System:** Framework for casting spells.
- **Cooldowns:** UI indicators for skill availability.
- **Targeting:** Skill shots (linear, circular) vs. Targeted abilities.

---

## Phase 4: Alpha 0.4 - Economy & Progression
**Goal:** Add strategic depth through resource management.

### 1. Gold & Experience
- Gold on last-hitting minions/heroes.
- Experience points and Leveling up.
- Stat growth per level.

### 2. The Shop
- **UI:** Shop interface available when in Base.
- **Items:** Basic items that modify stats (e.g., "Sword" +10 AD).
- **Inventory:** System to hold and equip items.

---

## Phase 5: Beta 0.5 - Enemy AI & Jungle
**Goal:** Create a single-player experience that mimics a real match.

### 1. Enemy Hero AI
- Bot logic to lane, farm, and trade damage.
- Retreat logic when low health.

### 2. Jungle Camps
- Neutral monsters in the areas between lanes.
- Buffs (Red/Blue buff equivalents).

---

## Phase 6: Beta 0.6 - Polish & Visuals
**Goal:** Make it look and feel good.

- **VFX:** Particle effects for attacks, skills, and hits.
- **SFX:** Audio for actions and ambience.
- **Fog of War:** Hiding areas not in vision.
- **Optimizations:** Object pooling for projectiles and minions.
