import React from "react";
import { RegionID, CityID } from "../../constant/general";
import { getCityText, getRegionText } from "../../util";
import styles from "../../styles/combat.module.css";

interface CombatHeaderProps {
  type: string;
  phase: string;
  region: RegionID | null;
  city: CityID | null;
  ongoing: boolean;
}

export const CombatHeader = ({ type, phase, region, city, ongoing }: CombatHeaderProps) => {
  const getTypeText = (t: string) => {
    if (t === 'siege') return '攻城';
    if (t === 'field') return '野战';
    if (t === 'breakout') return '突围';
    return t;
  };

  return (
    <div className={styles.combatHeader}>
      <h2 className={styles.combatTitle}>
        战斗进行中
      </h2>
      
      <div className={styles.combatMeta}>
        <span className={`${styles.combatBadge} ${styles[type.toLowerCase()] || ''}`}>
          {getTypeText(type)}
        </span>
        
        <span className={styles.phaseIndicator}>
          阶段: {phase}
        </span>
        
        <span className={styles.locationName}>
          {region ? getRegionText(region) : city ? getCityText(city) : ''}
        </span>
      </div>
    </div>
  );
};
