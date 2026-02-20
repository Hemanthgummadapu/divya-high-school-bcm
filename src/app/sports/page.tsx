import SportsSlideshow from "@/components/SportsSlideshow";

export default function Sports() {
  return (
    <div>
      <SportsSlideshow />
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-center mb-8">Sports</h1>
        <p className="text-center text-gray-600 max-w-2xl mx-auto">
          This is the sports page. Content will be added here.
        </p>
      </div>
    </div>
  );
}
