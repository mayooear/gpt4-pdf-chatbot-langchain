import React from 'react';
import styles from '@/styles/left-sidebar.module.css';
const FAQs = [
  'What is the Labour Party?',
  'What are the core beliefs of the Labour Party?',
  'How has the Labour Party performed in recent elections?',
  'What\'s the difference between "Old Labour" and "New Labour"?',
  'How is the leader of the Labour Party chosen?',
  'What is the relationship between the Labour Party and trade unions?',
  'Where can I find the Labour Party\'s official policies?'
];

type Prop = {
  onClick: (query: string) => unknown;
};

const FAQ: React.FC<Prop> = ({ onClick }) => {
  return (
    <article className={styles.faq}>
      <section>
        <h4>#FAQ</h4>
        <ul>
          {FAQs.map((question) => (
            <li>
              <p onClick={() => onClick(question)}>{question}</p>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
};

export default FAQ;
