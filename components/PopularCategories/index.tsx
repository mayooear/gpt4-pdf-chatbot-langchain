import React from 'react';
import styles from '@/styles/left-sidebar.module.css';


const categories = [
  'Competition Policy',
  'Corporate Governance',
  'Procurement',
  'Pillars of strategy',
  'industrial strategy'
];
type Props = {
  onClick: (category: string) => unknown;
};
const PopularCategories:React.FC<Props> = ({onClick}) => {
  return (
    <article className={styles.pop_cat_article}>
      <section>
        <ul className={styles.popular_categories}>
          {categories.map((category, index) => (
            <li key={index} onClick={() => onClick(category)}>{category}</li>
          ))}
        </ul>
      </section>
    </article>
  );
};

export default PopularCategories;
