import React from "react";
import { Country, SongJinnGame } from "../../constant/general";
import { getTroopText, sjCardById, getMeleeStr, getRangeStrength } from "../../util";
import { DiceDisplay } from "./DiceDisplay";
import { DamageBar } from "./DamageBar";
import styles from "../../styles/combat.module.css";

interface ForceCardProps {
  G: SongJinnGame;
  country: Country;
  troops: any[];
  combatCards: string[];
  dices: number[][];
  damageLeft: number;
  isActive: boolean;
}

export const ForceCard = ({ G, country, troops, combatCards, dices, damageLeft, isActive }: ForceCardProps) => {
  const totalMelee = troops.reduce((sum, troop) => {
    return sum + getMeleeStr(G, troop);
  }, 0);

  const totalRange = troops.reduce((sum, troop) => {
    return sum + getRangeStrength(G, troop);
  }, 0);

  const maxHP = troops.reduce((sum, troop) => {
    return sum + troop.u.reduce((s, count) => s + count, 0);
  }, 0);

  return (
    <div className={`${styles.forceCard} ${country === Country.SONG ? styles.song : styles.jinn} ${isActive ? styles.active : ''}`}>
      <div className={`${styles.countryName} ${country === Country.SONG ? styles.song : styles.jinn}`}>
        {country === Country.SONG ? '宋' : '金'}
      </div>
      
      <div className={styles.troopSection}>
        <div className={styles.sectionTitle}>部队</div>
        <div className={styles.troopList}>
          {troops.map((troop, idx) => (
            <div key={idx} className={styles.troopItem}>
              <span>{getTroopText(G, troop)}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className={styles.strengthStats}>
        <div className={styles.statItem}>
          <div className={styles.statLabel}>近战</div>
          <div className={`${styles.statValue} ${country === Country.SONG ? styles.song : styles.jinn}`}>
            {totalMelee}
          </div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statLabel}>远程</div>
          <div className={`${styles.statValue} ${country === Country.SONG ? styles.song : styles.jinn}`}>
            {totalRange}
          </div>
        </div>
      </div>
      
      {combatCards.length > 0 && (
        <div className={styles.combatCardsSection}>
          <div className={styles.sectionTitle}>战斗牌</div>
          <div className={styles.combatCardsList}>
            {combatCards.map((cardId, idx) => (
              <div key={idx} className={`${styles.combatCard} ${country === Country.SONG ? styles.song : styles.jinn}`}>
                {sjCardById(cardId).name}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <DiceDisplay dices={dices} country={country} />
      
      <DamageBar 
        current={damageLeft}
        max={maxHP}
        country={country}
      />
    </div>
  );
};
