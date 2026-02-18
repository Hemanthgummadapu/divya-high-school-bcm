import HeroSlideshow from "@/components/HeroSlideshow";

export default function Home() {
  return (
    <div>
      <HeroSlideshow />
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-center mb-8">
          Welcome to Divya High School BCM
        </h1>
        <p className="text-center text-gray-600 max-w-2xl mx-auto">
          This is the home page. Content will be added here.
        </p>
      </div>
    </div>
  );
}

