import { Fragment, useEffect } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { ChevronDown } from 'lucide-react';
import { usePineconeStore, TOPICS } from '@/config/pinecone';
import { useRouter } from 'next/router';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function TopicDropdown() {
  const router = useRouter();
  const { PINECONE_NAME_SPACE, setPineconeNamespace } = usePineconeStore();
  useEffect(() => console.log(PINECONE_NAME_SPACE), [PINECONE_NAME_SPACE]);

  useEffect(() => {
    if (
      router.query.topic &&
      router.query.topic !== PINECONE_NAME_SPACE.NAMESPACE
    ) {
      //set pinecone namespace to the namespace where NAMESPACE === router.query.topic
      const namespace = TOPICS.find(
        (topic) => topic.NAMESPACE === router.query.topic,
      );
      if (namespace) {
        setPineconeNamespace(namespace);
      }
    }
  }, [router.query]);

  return (
    <div className="inline-block justify-end sm:text-center px-2 sm:px-4">
      Select a Topic
      <Menu as="div" className="relative inline-block text-left ml-2">
        <div>
          <Menu.Button className="inline-flex w-full justify-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
            {PINECONE_NAME_SPACE.TOPIC}
            <ChevronDown className="h-5 w-5" />
          </Menu.Button>
        </div>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            {TOPICS.map((topic) => (
              <div className="py-1" key={topic.NAMESPACE}>
                <Menu.Item>
                  {({ active }) => (
                    <div
                      className={classNames(
                        active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                        'block px-4 py-2 text-sm hover:cursor-pointer',
                      )}
                      onClick={() => {
                        router.push({
                          pathname: router.pathname,
                          query: { topic: topic.NAMESPACE },
                        });
                      }}
                    >
                      {topic.TOPIC}
                    </div>
                  )}
                </Menu.Item>
              </div>
            ))}
          </Menu.Items>
        </Transition>
      </Menu>
    </div>
  );
}
