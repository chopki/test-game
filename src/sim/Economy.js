// Gold bookkeeping. Kept as its own module because the economy is where the
// game is planned to grow most (resource buildings, upkeep, multiple currencies).
export class Economy {
  constructor(startingGold, events) {
    this.gold = startingGold;
    this.totalEarned = 0;
    this.events = events;
  }

  canAfford(amount) {
    return this.gold >= amount;
  }

  spend(amount) {
    if (!this.canAfford(amount)) return false;
    this.gold -= amount;
    this.events?.emit('goldChanged', { gold: this.gold, delta: -amount });
    return true;
  }

  earn(amount, reason = 'other') {
    if (amount <= 0) return;
    this.gold += amount;
    this.totalEarned += amount;
    this.events?.emit('goldChanged', { gold: this.gold, delta: amount, reason });
  }
}
