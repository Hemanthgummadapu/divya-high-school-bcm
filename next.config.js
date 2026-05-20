/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/admissions/admission-process",
        destination: "/admissions",
        permanent: true,
      },
      {
        source: "/admissions/fee-structure",
        destination: "/admissions",
        permanent: true,
      },
      {
        source: "/admissions/apply-online",
        destination: "/admissions",
        permanent: true,
      },
      {
        source: "/admissions/online-form",
        destination: "/admissions",
        permanent: true,
      },
      {
        source: "/admissions/apply",
        destination: "/admissions",
        permanent: true,
      },
      {
        source: "/academics/curriculum",
        destination: "/academics",
        permanent: true,
      },
      {
        source: "/academics/results",
        destination: "/academics#results",
        permanent: true,
      },
      {
        source: "/academics/overview",
        destination: "/academics",
        permanent: true,
      },
      {
        source: "/sports/cultural-activities",
        destination: "/gallery",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
