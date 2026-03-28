'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface Category {
  id: string;
  name: string;
  slug: string;
  children?: Category[];
}

interface CategoriesResponse {
  success: boolean;
  data: Category[];
  message: string;
}

export default function CategoryNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [, setSelectedCategory] = useState<Category | null>(null);

  const { data: categoriesData } = useQuery<CategoriesResponse>({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await fetch('/api/homepage/categories');
      return response.json();
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });

  const categories = categoriesData?.data || [];

  const filteredCategories = searchQuery
    ? flattenCategories(categories).filter(category =>
        category.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  function flattenCategories(cats: Category[]): Category[] {
    return cats.reduce<Category[]>((acc, category) => {
      acc.push(category);
      if (category.children) {
        acc.push(...flattenCategories(category.children));
      }
      return acc;
    }, []);
  }

  return (
    <div className="relative bg-white border-b border-gray-200">
      {/* Desktop Navigation */}
      <div className="hidden md:flex max-w-7xl mx-auto px-4 py-3">
        <div className="relative flex-1">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span>Browse Categories</span>
            <svg
              className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              {/* Search Input */}
              <div className="p-3 border-b border-gray-200">
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Categories List */}
              <div className="max-h-96 overflow-y-auto">
                {searchQuery ? (
                  <div className="p-2">
                    {filteredCategories.length > 0 ? (
                      filteredCategories.map((category) => (
                        <button
                          key={category.id}
                          onClick={() => {
                            setSelectedCategory(category);
                            setIsOpen(false);
                            setSearchQuery('');
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md transition-colors"
                        >
                          {category.name}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-gray-500">No categories found</div>
                    )}
                  </div>
                ) : (
                  <div className="p-2">
                    {categories.map((category) => (
                      <CategoryItem
                        key={category.id}
                        category={category}
                        onSelect={(cat) => {
                          setSelectedCategory(cat);
                          setIsOpen(false);
                        }}
                        level={0}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <div className="flex items-center space-x-6 ml-8">
          <a href="/browse" className="text-gray-700 hover:text-blue-600 transition-colors">
            Browse
          </a>
          <a href="/sell" className="text-gray-700 hover:text-blue-600 transition-colors">
            Sell
          </a>
          <a href="/post-requirement" className="text-gray-700 hover:text-blue-600 transition-colors">
            Post Requirement
          </a>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden sticky top-0 bg-white border-b border-gray-200 z-40">
        <div className="px-4 py-3">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            <span>Categories</span>
            <svg
              className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 mt-1 rounded-lg shadow-lg">
              <div className="p-3 border-b border-gray-200">
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="max-h-64 overflow-y-auto p-2">
                {searchQuery ? (
                  filteredCategories.length > 0 ? (
                    filteredCategories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => {
                          setSelectedCategory(category);
                          setIsOpen(false);
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        {category.name}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-gray-500">No categories found</div>
                  )
                ) : (
                  categories.map((category) => (
                    <MobileCategoryItem
                      key={category.id}
                      category={category}
                      onSelect={(cat) => {
                        setSelectedCategory(cat);
                        setIsOpen(false);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryItem({
  category,
  onSelect,
  level,
}: {
  category: Category;
  onSelect: (category: Category) => void;
  level: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => {
          if (category.children && category.children.length > 0) {
            setIsExpanded(!isExpanded);
          } else {
            onSelect(category);
          }
        }}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100 rounded-md transition-colors"
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        <span>{category.name}</span>
        {category.children && category.children.length > 0 && (
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>

      {isExpanded && category.children && (
        <div>
          {category.children.map((child) => (
            <CategoryItem
              key={child.id}
              category={child}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MobileCategoryItem({
  category,
  onSelect,
}: {
  category: Category;
  onSelect: (category: Category) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => {
          if (category.children && category.children.length > 0) {
            setIsExpanded(!isExpanded);
          } else {
            onSelect(category);
          }
        }}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100 rounded-md transition-colors"
      >
        <span>{category.name}</span>
        {category.children && category.children.length > 0 && (
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>

      {isExpanded && category.children && (
        <div className="pl-4">
          {category.children.map((child) => (
            <MobileCategoryItem
              key={child.id}
              category={child}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}