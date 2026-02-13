import { Link } from 'react-router-dom';
import { Heart, ArrowLeft } from 'lucide-react';

export default function ThankYouPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-[#1B3A6B] to-[#0f2340] text-white flex items-center justify-center px-4">
      <div className="text-center max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur px-6 py-10">
        <Heart className="w-16 h-16 mx-auto mb-5 text-[#C41E3A]" />
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          Si Yu'os Ma'åse!
        </h1>
        <p className="text-xl text-blue-100 mb-2">
          Thank you for supporting Josh & Tina!
        </p>
        <p className="text-blue-200 mb-8">
          Together, we'll build a stronger Guam. We'll be in touch!
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-blue-100 hover:text-white bg-white/10 px-4 py-2 rounded-xl min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </div>
    </div>
  );
}
