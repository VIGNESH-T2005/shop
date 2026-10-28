import { EmptyState } from '../components/StateViews';
export default function NotFound() {
  return <div className="container-x py-24"><EmptyState title="That page doesn’t exist" body="The link may be old, or the product may have been removed." cta={{ to: '/shop', label: 'Browse the shop' }} /></div>;
}
