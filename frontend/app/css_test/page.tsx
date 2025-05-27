// frontend/app/css_test/page.tsx
'use client';

import styles from './styles.module.css';

export default function CssTestPage() {
    return (
        <div className={styles.container}>
            <h1 className={styles.heading}>CSS Test Page</h1>
            <p className={styles.text}>If you can see this styled text, CSS is working!</p>

            <div className={styles.boxContainer}>
                <div className={`${styles.box} ${styles.blueBox}`}>Blue Box</div>
                <div className={`${styles.box} ${styles.greenBox}`}>Green Box</div>
                <div className={`${styles.box} ${styles.redBox}`}>Red Box</div>
                <div className={`${styles.box} ${styles.yellowBox}`}>Yellow Box</div>
            </div>

            <button className={styles.button}>
                Test Button
            </button>
        </div>
    );
}