import { Link } from 'react-router-dom';
import { Heart, ArrowLeft } from 'lucide-react';

export default function ThankYouPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1B3A6B] to-[#0f2340] text-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <Heart className="w-20 h-20 mx-auto mb-6 text-[#C41E3A]" />
        <h1 className="text-3xl font-bold mb-4">
          Si Yu'os Ma'åse!
        </h1>
        <p className="text-xl text-blue-200 mb-2">
          Thank you for supporting Josh & Tina!
        </p>
        <p className="text-blue-300 mb-8">
          Together, we'll build a stronger Guam. We'll be in touch!
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-blue-200 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </div>
    </div>
  );
}
