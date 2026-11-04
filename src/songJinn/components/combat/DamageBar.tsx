import React from "react";
import { Country } from "../../constant/general";
import styles from "../../styles/combat.module.css";

interface DamageBarProps {
  current: number;
  max: number;
  country: Country;
}

function getHealthStatus(current: number, max: number): string {
  if (max === 0) return 'healthy';
  const percentage = current / max;
  if (percentage > 0.6) return 'healthy';
  if (percentage > 0.3) return 'damaged';
  return 'critical';
}

export const DamageBar = ({ current, max }: DamageBarProps) => {
  const percentage = max === 0 ? 0 : (current / max) * 100;
  
  return (
    <div className={styles.damageSection}>
      <div className={styles.sectionTitle}>生命值</div>
      
      <div className={styles.damageBar}>
        <div 
          className={`${styles.damageBarFill} ${styles[getHealthStatus(current, max)]}`}
          style={{ width: `${percentage}%` }}
        >
        </div>
        <span className={styles.damageLabel}>
          {current}/{max} HP
        </span>
      </div>
    </div>
  );
};
