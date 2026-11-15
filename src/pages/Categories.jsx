import TaxonomyList from './TaxonomyList'

// The heading, search wording and intro are in the database (Admin > Site content > Site pages; src/lib/pageCopy.js).
export default function Categories() {
  return <TaxonomyList field="tags" copyKey="categories" basePath="/category" withImages />
}
