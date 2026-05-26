import type { Metadata } from 'next';
import WizardRoute from './WizardRoute';

export const metadata: Metadata = {
  title: '지금 어디 계세요? — 에어컨 민주주의',
  alternates: { canonical: '/wizard' },
};

export default function Page() {
  return <WizardRoute />;
}
