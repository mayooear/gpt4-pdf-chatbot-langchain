import Link from 'next/link';
import React from 'react';

const Navbar = () => {
  return (
    <nav>
      <ul>
        <li>
          <Link href="/">
            <a>Ask</a>
          </Link>
        </li>
        <li>
          <Link href="/all">
            <a>All&nbsp;Answers</a>
          </Link>
        </li>
      </ul>
    </nav>
  );
};

export default Navbar;
