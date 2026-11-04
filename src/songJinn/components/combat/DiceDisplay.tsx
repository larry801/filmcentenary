import React from "react";
import { Country } from "../../constant/general";
import styles from "../../styles/combat.module.css";

interface DiceDisplayProps {
  dices: number[][];
  country: Country;
}

const DIE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export const DiceDisplay = ({ dices }: DiceDisplayProps) => {
  const currentDiceSet = dices.length > 0 ? dices[dices.length - 1] : [];

  return (
    <div className={styles.diceContainer}>
      <div className={styles.sectionTitle}>骰子</div>
      
      <div className={styles.diceGrid}>
        {currentDiceSet.map((value, idx) => (
          <span 
            key={idx} 
            className={`${styles.diceFace} ${value > 3 ? styles.success : ''}`}
          >
            {DIE_FACES[value - 1] || value}
          </span>
        ))}
      </div>
      
      <div className={styles.diceStats}>
        <div className={styles.diceStat}>
          <span>&gt;2:</span>
          <span className={styles.diceCount}>{currentDiceSet.filter(d => d > 2).length}</span>
        </div>
        <div className={styles.diceStat}>
          <span>&gt;3:</span>
          <span className={styles.diceCount}>{currentDiceSet.filter(d => d > 3).length}</span>
        </div>
        <div className={styles.diceStat}>
          <span>&gt;4:</span>
          <span className={styles.diceCount}>{currentDiceSet.filter(d => d > 4).length}</span>
        </div>
        <div className={styles.diceStat}>
          <span>&gt;5:</span>
          <span className={styles.diceCount}>{currentDiceSet.filter(d => d > 5).length}</span>
        </div>
      </div>
    </div>
  );
};
