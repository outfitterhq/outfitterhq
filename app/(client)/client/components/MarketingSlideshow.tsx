"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface MarketingPhoto {
  id: string;
  photoUrl: string;
  species?: string;
  weapon?: string;
  unit?: string;
  seasonYear?: number;
}

interface MarketingSlideshowProps {
  outfitterId: string;
  clientEmail: string;
  onSkip: () => void;
  onContinue: () => void;
}

export default function MarketingSlideshow({
  outfitterId,
  clientEmail,
  onSkip,
  onContinue,
}: MarketingSlideshowProps) {
  const [photos, setPhotos] = useState<MarketingPhoto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-advance timer
  useEffect(() => {
    if (!isAutoAdvancing || photos.length === 0) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    }, 5000); // 5 seconds per photo

    return () => clearInterval(timer);
  }, [isAutoAdvancing, photos.length]);

  // Load marketing photos
  useEffect(() => {
    loadMarketingPhotos();
  }, [outfitterId, clientEmail]);

  async function loadMarketingPhotos() {
    setIsLoading(true);
    setError(null);

    try {
      // Get client's contracts for personalization
      const contractsRes = await fetch("/api/client/hunt-contract");
      const contractsData = await contractsRes.json().catch(() => ({ contracts: [] }));
      const contracts = contractsData.contracts || [];

      // Extract species from contracts for personalization
      const contractSpecies: string[] = [];
      contracts.forEach((contract: any) => {
        if (contract.hunt?.species) {
          contractSpecies.push(contract.hunt.species);
        }
      });

      // Call RPC to get success records with marketing photos
      const res = await fetch(`/api/client/marketing-photos?outfitter_id=${encodeURIComponent(outfitterId)}`);
      if (!res.ok) {
        throw new Error("Failed to load marketing photos");
      }

      const data = await res.json();
      let marketingPhotos: MarketingPhoto[] = data.photos || [];

      // Personalize: 60% matching species, 40% variety
      if (contractSpecies.length > 0 && marketingPhotos.length > 0) {
        const matchingPhotos = marketingPhotos.filter((photo) =>
          contractSpecies.some((species) =>
            species.toLowerCase() === (photo.species || "").toLowerCase()
          )
        );
        const otherPhotos = marketingPhotos.filter(
          (photo) =>
            !contractSpecies.some((species) =>
              species.toLowerCase() === (photo.species || "").toLowerCase()
            )
        );

        const totalPhotos = marketingPhotos.length;
        const targetMatchingCount = Math.floor(totalPhotos * 0.6);
        const targetOtherCount = totalPhotos - targetMatchingCount;

        const personalized: MarketingPhoto[] = [];
        for (let i = 0; i < Math.min(matchingPhotos.length, targetMatchingCount); i++) {
          personalized.push(matchingPhotos[i]);
        }
        for (let i = 0; i < Math.min(otherPhotos.length, targetOtherCount); i++) {
          personalized.push(otherPhotos[i]);
        }

        // Fill remaining with others if needed
        if (personalized.length < totalPhotos) {
          const remaining = totalPhotos - personalized.length;
          personalized.push(...otherPhotos.slice(targetOtherCount, targetOtherCount + remaining));
        }

        // Shuffle
        for (let i = personalized.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [personalized[i], personalized[j]] = [personalized[j], personalized[i]];
        }

        setPhotos(personalized);
      } else {
        // Shuffle all photos if no contracts
        const shuffled = [...marketingPhotos];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        setPhotos(shuffled);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load photos");
      setPhotos([]);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div className="pro-spinner" style={{ width: 48, height: 48 }}></div>
        <p style={{ fontSize: 18 }}>Loading Success Stories...</p>
      </div>
    );
  }

  if (error) {
    // If error loading photos, show error but don't auto-redirect
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          flexDirection: "column",
          gap: 20,
          padding: 40,
        }}
      >
        <p style={{ fontSize: 18, textAlign: "center" }}>Unable to load photos</p>
        <button
          onClick={onContinue}
          style={{
            padding: "12px 24px",
            background: "white",
            color: "#1a472a",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Continue to Dashboard
        </button>
      </div>
    );
  }

  // Handle empty photos - redirect after component mounts
  useEffect(() => {
    if (photos.length === 0 && !isLoading && !error) {
      // No photos available, skip to dashboard
      const timer = setTimeout(() => {
        onContinue();
      }, 500); // Small delay to avoid flash
      return () => clearTimeout(timer);
    }
  }, [photos.length, isLoading, error]);

  if (photos.length === 0 && !isLoading && !error) {
    // Show loading state while redirecting
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div className="pro-spinner" style={{ width: 48, height: 48 }}></div>
        <p style={{ fontSize: 18 }}>No photos available</p>
      </div>
    );
  }

  const currentPhoto = photos[currentIndex];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top bar with skip button */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: 20,
          display: "flex",
          justifyContent: "flex-end",
          zIndex: 10,
        }}
      >
        <button
          onClick={onSkip}
          style={{
            padding: "10px 20px",
            background: "rgba(0,0,0,0.5)",
            color: "white",
            border: "none",
            borderRadius: 20,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Skip
        </button>
      </div>

      {/* Photo display */}
      <div
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${currentPhoto.photoUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />

        {/* Overlay with photo info */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
            padding: 40,
            color: "white",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {currentPhoto.species && (
              <h2 style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>
                {currentPhoto.species}
              </h2>
            )}
            {currentPhoto.unit && (
              <p style={{ margin: 0, fontSize: 18, opacity: 0.9 }}>Unit {currentPhoto.unit}</p>
            )}
            {currentPhoto.seasonYear && (
              <p style={{ margin: 0, fontSize: 16, opacity: 0.8 }}>{currentPhoto.seasonYear} Season</p>
            )}
          </div>
        </div>

        {/* Navigation dots */}
        <div
          style={{
            position: "absolute",
            bottom: 120,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 8,
          }}
        >
          {photos.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentIndex(idx);
                setIsAutoAdvancing(false);
                setTimeout(() => setIsAutoAdvancing(true), 3000);
              }}
              style={{
                width: idx === currentIndex ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: idx === currentIndex ? "white" : "rgba(255,255,255,0.5)",
                border: "none",
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>
      </div>

      {/* Bottom action buttons */}
      <div
        style={{
          padding: 32,
          background: "rgba(0,0,0,0.8)",
          display: "flex",
          gap: 16,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => {
            setIsAutoAdvancing(!isAutoAdvancing);
          }}
          style={{
            padding: "12px 24px",
            background: "rgba(255,255,255,0.2)",
            color: "white",
            border: "2px solid white",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {isAutoAdvancing ? "⏸ Pause" : "▶ Play"}
        </button>
        <Link
          href="/client/success-history"
          style={{
            padding: "12px 24px",
            background: "rgba(255,255,255,0.2)",
            color: "white",
            border: "2px solid white",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          View All
        </Link>
        <button
          onClick={onContinue}
          style={{
            padding: "12px 24px",
            background: "#1a472a",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Continue to Dashboard
        </button>
      </div>
    </div>
  );
}
