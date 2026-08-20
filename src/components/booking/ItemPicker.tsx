"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import { motion, type Variants } from "framer-motion";
import { Box, Text, HStack, VStack, SimpleGrid } from "@chakra-ui/react";
import type { IconType } from "react-icons";
import {
  FiActivity,
  FiAlertTriangle,
  FiArchive,
  FiAward,
  FiBriefcase,
  FiCoffee,
  FiDroplet,
  FiGrid,
  FiHeart,
  FiHome,
  FiMinus,
  FiMoon,
  FiMoreHorizontal,
  FiMusic,
  FiPackage,
  FiPlus,
  FiSearch,
  FiShoppingBag,
  FiSmile,
  FiSquare,
  FiSun,
  FiX,
  FiZap,
} from "react-icons/fi";
import { colors } from "@/lib/tokens";

const MotionBox = motion.create(Box);

// Propagating variant: card lifts on hover, image zooms in sync
const cardVariants: Variants = {
  initial: { y: 0, boxShadow: "0 0px 0px rgba(0,0,0,0)" },
  hover: { y: -3, boxShadow: "0 10px 28px rgba(0,0,0,0.5)", transition: { duration: 0.2, ease: "easeOut" as const } },
};
const imageVariants: Variants = {
  initial: { scale: 1 },
  hover: { scale: 1.1, transition: { duration: 0.38, ease: "easeOut" as const } },
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SelectedItem {
  itemId: string;
  name: string;
  imagePath: string;
  quantity: number;
}

interface ApiItem {
  id: string;
  name: string;
  slug: string;
  imagePath: string;
  weight: string;
  size: string;
  sortOrder: number;
}

interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  type: string;
  sortOrder: number;
  items: ApiItem[];
}

interface ItemPickerProps {
  serviceType?: string; // 'house-move' | 'business-removals' | 'office-removals' | etc.
  selectedItems: SelectedItem[];
  onItemsChange: (items: SelectedItem[]) => void;
}

type ItemIdentity = Pick<ApiItem, "id" | "name" | "imagePath">;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getApiType(serviceType?: string): string {
  const bizSlugs = ["business-removals", "office-removals", "hotel-removals"];
  if (bizSlugs.includes(serviceType ?? "")) return "business";
  return "residential";
}

const CATEGORY_ICONS: Record<string, IconType> = {
  FiActivity,
  FiAlertTriangle,
  FiArchive,
  FiAward,
  FiBriefcase,
  FiCoffee,
  FiDroplet,
  FiGrid,
  FiHeart,
  FiHome,
  FiMoon,
  FiMoreHorizontal,
  FiMusic,
  FiShoppingBag,
  FiSmile,
  FiSquare,
  FiSun,
  FiZap,
};

const SEARCH_ALIASES: Record<string, string[]> = {
  couch: ["sofa", "settee"],
  settee: ["sofa", "couch"],
  telly: ["tv", "television"],
  television: ["tv"],
  fridge: ["fridge", "freezer"],
  freezer: ["fridge", "freezer"],
  washer: ["washing", "machine"],
  wardrobe: ["wardrobe", "closet"],
  closet: ["wardrobe", "closet"],
  cupboard: ["cabinet", "wardrobe"],
  drawer: ["drawers", "chest"],
  drawers: ["drawer", "chest"],
  carton: ["box", "boxes"],
  cartons: ["box", "boxes"],
  boxes: ["box"],
  box: ["boxes"],
};

const SEARCH_SHORTCUTS = ["Sofa", "Bed", "Wardrobe", "Boxes", "TV", "Fridge", "Desk", "Table"];

const POPULAR_ITEM_GROUPS: Array<{ label: string; keywordGroups: string[][] }> = [
  { label: "Sofa", keywordGroups: [["sofa"], ["couch"], ["settee"]] },
  { label: "Armchair", keywordGroups: [["armchair"], ["accent", "chair"]] },
  { label: "Bed", keywordGroups: [["bed", "frame"], ["bed"]] },
  { label: "Wardrobe", keywordGroups: [["wardrobe"], ["closet"]] },
  { label: "Chest drawers", keywordGroups: [["chest", "drawer"], ["drawers"]] },
  { label: "TV", keywordGroups: [["tv"], ["television"]] },
  { label: "Fridge", keywordGroups: [["fridge"], ["freezer"]] },
  { label: "Washing machine", keywordGroups: [["washing", "machine"], ["washer"]] },
  { label: "Dining table", keywordGroups: [["dining", "table"], ["table"]] },
  { label: "Desk", keywordGroups: [["desk"]] },
  { label: "Boxes", keywordGroups: [["moving", "box"], ["boxes"], ["box"]] },
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function itemMatchesTerms(item: ApiItem, terms: string[]): boolean {
  const haystack = normalizeText(`${item.name} ${item.slug}`);
  return terms.every((term) => haystack.includes(normalizeText(term)));
}

function itemMatchesQuery(item: ApiItem, query: string): boolean {
  const haystack = normalizeText(`${item.name} ${item.slug}`);
  const tokens = normalizeText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return false;

  return tokens.every((token) => {
    if (haystack.includes(token)) return true;
    return (SEARCH_ALIASES[token] ?? []).some((alias) => haystack.includes(normalizeText(alias)));
  });
}

function findPopularItem(categories: ApiCategory[], keywordGroups: string[][]): ApiItem | null {
  for (const keywords of keywordGroups) {
    for (const category of categories) {
      const match = category.items.find((item) => itemMatchesTerms(item, keywords));
      if (match) return match;
    }
  }
  return null;
}

// ─── Skeleton card (shown while categories load) ─────────────────────────────
function SkeletonCard() {
  const shimmer = {
    background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0) 100%)",
    backgroundSize: "200% 100%",
    animation: "maShimmer 1.6s ease-in-out infinite",
  };
  return (
    <Box borderRadius="xl" overflow="hidden" border="2px solid rgba(255,255,255,0.06)" bg="rgba(255,255,255,0.02)">
      <Box position="relative" w="full" pb="80%" overflow="hidden" bg="rgba(255,255,255,0.04)">
        <Box position="absolute" inset={0} style={shimmer} />
      </Box>
      <Box px={2} pt={1.5} pb={2}>
        <Box h="20px" borderRadius="sm" bg="rgba(255,255,255,0.05)" mb={2} overflow="hidden">
          <Box h="full" style={{ ...shimmer, animationDelay: "0.1s" }} />
        </Box>
        <Box h="24px" borderRadius="md" bg="rgba(255,255,255,0.04)" />
      </Box>
    </Box>
  );
}

function PopularItemButton({
  label,
  item,
  quantity,
  onIncrease,
  onDecrease,
}: {
  label: string;
  item: ApiItem;
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const isSelected = quantity > 0;

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onIncrease}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onIncrease();
        }
      }}
      minW={{ base: "132px", sm: "148px" }}
      maxW={{ base: "132px", sm: "148px" }}
      borderRadius="xl"
      border={`2px solid ${isSelected ? colors.emerald : "rgba(255,255,255,0.1)"}`}
      bg={isSelected ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.035)"}
      overflow="hidden"
      cursor="pointer"
      textAlign="left"
      _hover={{ borderColor: colors.emerald }}
    >
      <Box position="relative" w="full" h="84px" bg="rgba(255,255,255,0.05)">
        <Image
          src={item.imagePath}
          alt={item.name}
          fill
          sizes="150px"
          loading="lazy"
          style={{ objectFit: "contain", padding: "8px" }}
        />
        {isSelected && (
          <Box
            position="absolute"
            top={2}
            right={2}
            minW="22px"
            h="22px"
            px={1.5}
            borderRadius="full"
            bg={colors.emerald}
            color="white"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontSize="2xs"
            fontWeight={900}
          >
            {quantity}
          </Box>
        )}
      </Box>
      <Box px={2.5} py={2}>
        <Text fontSize="xs" fontWeight={800} color="white" lineHeight="short" truncate>
          {label}
        </Text>
        <Text fontSize="2xs" color="rgba(255,255,255,0.45)" lineHeight="short" truncate>
          {item.name}
        </Text>
        <HStack mt={2} gap={1.5} onClick={(e) => e.stopPropagation()}>
          <Box
            as="button"
            aria-label={`Remove ${label}`}
            onClick={onDecrease}
            w="28px"
            h="28px"
            borderRadius="md"
            bg="rgba(255,255,255,0.08)"
            color="white"
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor={quantity > 0 ? "pointer" : "not-allowed"}
            opacity={quantity > 0 ? 1 : 0.35}
            _hover={quantity > 0 ? { bg: "rgba(255,255,255,0.16)" } : {}}
          >
            <FiMinus size={12} />
          </Box>
          <Box
            as="button"
            aria-label={`Add ${label}`}
            onClick={onIncrease}
            flex="1"
            h="28px"
            borderRadius="md"
            bg={colors.amber}
            color="#0b1120"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontWeight={900}
            _hover={{ bg: "#f4b000" }}
          >
            <FiPlus size={13} />
          </Box>
        </HStack>
      </Box>
    </Box>
  );
}

function SelectedItemsTray({
  selectedItems,
  totalCount,
  onIncrease,
  onDecrease,
  onClear,
}: {
  selectedItems: SelectedItem[];
  totalCount: number;
  onIncrease: (item: SelectedItem) => void;
  onDecrease: (item: SelectedItem) => void;
  onClear: () => void;
}) {
  if (totalCount === 0) return null;

  return (
    <Box
      w="full"
      mb={4}
      px={3}
      py={3}
      borderRadius="xl"
      bg="rgba(16,185,129,0.08)"
      border="1px solid rgba(16,185,129,0.25)"
    >
      <HStack justify="space-between" align="center" mb={3}>
        <VStack gap={0} align="start">
          <Text fontSize="sm" fontWeight={900} color={colors.emerald} lineHeight={1}>
            {totalCount} item{totalCount !== 1 ? "s" : ""} selected
          </Text>
          <Text fontSize="2xs" color="rgba(255,255,255,0.48)" fontWeight={600}>
            {selectedItems.length} type{selectedItems.length !== 1 ? "s" : ""}
          </Text>
        </VStack>
        <Box
          as="button"
          onClick={onClear}
          px={3}
          py={1.5}
          borderRadius="md"
          border="1px solid rgba(255,255,255,0.14)"
          color="rgba(255,255,255,0.72)"
          fontSize="xs"
          fontWeight={800}
          _hover={{ color: "white", borderColor: "rgba(255,255,255,0.28)" }}
        >
          Clear
        </Box>
      </HStack>

      <Box
        display="flex"
        gap={2}
        overflowX="auto"
        pb={1}
        css={{ scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}
      >
        {selectedItems.map((item) => (
          <HStack
            key={item.itemId}
            gap={2}
            minW="190px"
            maxW="220px"
            px={2}
            py={2}
            borderRadius="lg"
            bg="rgba(11,17,32,0.45)"
            border="1px solid rgba(255,255,255,0.1)"
          >
            <Box
              position="relative"
              w="42px"
              h="42px"
              borderRadius="md"
              overflow="hidden"
              bg="rgba(255,255,255,0.06)"
              flexShrink={0}
            >
              <Image
                src={item.imagePath}
                alt={item.name}
                fill
                sizes="42px"
                style={{ objectFit: "contain", padding: "4px" }}
              />
            </Box>
            <VStack gap={1} align="start" minW={0} flex="1">
              <Text fontSize="xs" color="white" fontWeight={800} lineHeight="short" truncate w="full">
                {item.name}
              </Text>
              <HStack gap={1.5}>
                <Box
                  as="button"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => onDecrease(item)}
                  w="24px"
                  h="24px"
                  borderRadius="md"
                  bg="rgba(255,255,255,0.08)"
                  color="white"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  _hover={{ bg: "rgba(255,255,255,0.16)" }}
                >
                  <FiMinus size={11} />
                </Box>
                <Text fontFamily="mono" fontSize="xs" fontWeight={900} color={colors.amber} w="20px" textAlign="center">
                  {item.quantity}
                </Text>
                <Box
                  as="button"
                  aria-label={`Add ${item.name}`}
                  onClick={() => onIncrease(item)}
                  w="24px"
                  h="24px"
                  borderRadius="md"
                  bg={colors.emerald}
                  color="white"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  _hover={{ bg: "#0ca572" }}
                >
                  <FiPlus size={11} />
                </Box>
              </HStack>
            </VStack>
          </HStack>
        ))}
      </Box>
    </Box>
  );
}

// ─── Item Card ────────────────────────────────────────────────────────────────
function ItemCard({
  item,
  quantity,
  onIncrease,
  onDecrease,
}: {
  item: ApiItem;
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const isSelected = quantity > 0;
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <MotionBox
      variants={cardVariants}
      initial="initial"
      whileHover="hover"
      whileTap={{ scale: 0.96, y: 0, transition: { duration: 0.1 } }}
      borderRadius="xl"
      overflow="hidden"
      border={`2px solid ${isSelected ? colors.emerald : "rgba(255,255,255,0.08)"}`}
      bg={isSelected ? "rgba(16,185,129,0.07)" : "rgba(255,255,255,0.03)"}
      position="relative"
      cursor="pointer"
      onClick={onIncrease}
      style={{ transition: "border-color 0.15s ease, background-color 0.15s ease" }}
    >
      {/* Image area */}
      <Box
        position="relative"
        w="full"
        pb="86%"
        overflow="hidden"
        background={
          isSelected
            ? "radial-gradient(circle at 50% 40%, rgba(16,185,129,0.14) 0%, rgba(16,185,129,0.03) 100%)"
            : "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)"
        }
      >
        {/* Shimmer while image loads */}
        {!imgLoaded && (
          <Box
            position="absolute"
            inset={0}
            style={{
              background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0) 100%)",
              backgroundSize: "200% 100%",
              animation: "maShimmer 1.6s ease-in-out infinite",
            }}
          />
        )}

        {/* Zoom wrapper — scales in sync with the card hover variant */}
        <MotionBox variants={imageVariants} position="absolute" inset={0}>
          <Image
            src={item.imagePath}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 20vw"
            quality={75}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            style={{ objectFit: "contain", padding: "8px" }}
          />
        </MotionBox>

        {/* Subtle selected tint */}
        {isSelected && (
          <Box position="absolute" inset={0} bg="rgba(16,185,129,0.07)" pointerEvents="none" />
        )}

        {/* Checkmark badge with glow */}
        {isSelected && (
          <Box
            position="absolute"
            top={1.5}
            right={1.5}
            w="22px"
            h="22px"
            borderRadius="full"
            bg={colors.emerald}
            display="flex"
            alignItems="center"
            justifyContent="center"
            boxShadow={`0 2px 8px rgba(16,185,129,0.65)`}
            zIndex={2}
          >
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Box>
        )}

        {/* Bottom gradient fade into info strip */}
        <Box
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          h="18px"
          background="linear-gradient(to top, rgba(11,17,32,0.55) 0%, transparent 100%)"
          pointerEvents="none"
          zIndex={1}
        />
      </Box>

      {/* Name + stepper controls */}
      <Box px={2} pt={1.5} pb={2}>
        <Text
          fontSize="xs"
          fontWeight={600}
          color={isSelected ? "white" : "rgba(255,255,255,0.65)"}
          lineHeight="tight"
          minH="30px"
          overflow="hidden"
          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
          mb={2}
        >
          {item.name}
        </Text>

        <HStack justify="center" gap={1.5}>
          <Box
            as="button"
            aria-label={`Remove ${item.name}`}
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDecrease(); }}
            w="30px"
            h="30px"
            borderRadius="md"
            bg={quantity > 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)"}
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor={quantity > 0 ? "pointer" : "not-allowed"}
            opacity={quantity > 0 ? 1 : 0.3}
            color="white"
            transition="background 0.15s ease"
            _hover={quantity > 0 ? { bg: "rgba(255,255,255,0.22)" } : {}}
          >
            <FiMinus size={12} />
          </Box>
          <Text
            fontFamily="mono"
            fontSize="xs"
            fontWeight={700}
            color={isSelected ? colors.amber : "rgba(255,255,255,0.2)"}
            w="20px"
            textAlign="center"
          >
            {quantity}
          </Text>
          <Box
            as="button"
            aria-label={`Add ${item.name}`}
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onIncrease(); }}
            w="30px"
            h="30px"
            borderRadius="md"
            bg={colors.emerald}
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            color="white"
            transition="background 0.15s ease"
            _hover={{ bg: "#0ca572" }}
          >
            <FiPlus size={12} />
          </Box>
        </HStack>
      </Box>
    </MotionBox>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ItemPicker({ serviceType, selectedItems, onItemsChange }: ItemPickerProps) {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCatIdx, setActiveCatIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const tabsRef = useRef<HTMLDivElement>(null);

  // Fetch categories on mount / serviceType change
  useEffect(() => {
    const apiType = getApiType(serviceType);
    setLoading(true);
    setActiveCatIdx(0);
    fetch(`/api/items?type=${apiType}`)
      .then((r) => r.json())
      .then((data: ApiCategory[]) => setCategories(data))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, [serviceType]);

  // Scroll active tab into view
  useEffect(() => {
    const tab = tabsRef.current?.querySelectorAll("[data-tab]")[activeCatIdx] as HTMLElement | null;
    tab?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeCatIdx]);

  // Quantity helpers
  const getQty = useCallback(
    (itemId: string) => selectedItems.find((s) => s.itemId === itemId)?.quantity ?? 0,
    [selectedItems]
  );

  const setQty = useCallback(
    (item: ItemIdentity, delta: number) => {
      const current = selectedItems.find((s) => s.itemId === item.id);
      const currentQty = current?.quantity ?? 0;
      const newQty = Math.max(0, currentQty + delta);

      if (newQty === 0) {
        onItemsChange(selectedItems.filter((s) => s.itemId !== item.id));
      } else if (current) {
        onItemsChange(selectedItems.map((s) => s.itemId === item.id ? { ...s, quantity: newQty } : s));
      } else {
        onItemsChange([...selectedItems, { itemId: item.id, name: item.name, imagePath: item.imagePath, quantity: newQty }]);
      }
    },
    [selectedItems, onItemsChange]
  );

  const popularItems = useMemo(() => {
    const usedIds = new Set<string>();
    return POPULAR_ITEM_GROUPS.flatMap((group) => {
      const item = findPopularItem(categories, group.keywordGroups);
      if (!item || usedIds.has(item.id)) return [];
      usedIds.add(item.id);
      return [{ ...group, item }];
    }).slice(0, 10);
  }, [categories]);

  // Search results (max 50)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const results: ApiItem[] = [];
    for (const cat of categories) {
      for (const item of cat.items) {
        if (itemMatchesQuery(item, searchQuery)) {
          results.push(item);
          if (results.length >= 50) return results;
        }
      }
    }
    return results;
  }, [categories, searchQuery]);

  const totalCount = selectedItems.reduce((s, i) => s + i.quantity, 0);
  const activeCategory = categories[activeCatIdx];
  const displayItems = searchResults ?? activeCategory?.items ?? [];
  const setSelectedItemQty = useCallback(
    (item: SelectedItem, delta: number) => setQty({ id: item.itemId, name: item.name, imagePath: item.imagePath }, delta),
    [setQty]
  );

  if (loading) {
    return (
      <VStack align="start" gap={0} w="full">
        {/* Search bar skeleton */}
        <Box w="full" mb={3} h="36px" borderRadius="xl" bg="rgba(255,255,255,0.05)" overflow="hidden">
          <Box
            h="full"
            style={{
              background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0) 100%)",
              backgroundSize: "200% 100%",
              animation: "maShimmer 1.6s ease-in-out infinite",
            }}
          />
        </Box>
        {/* Tab bar skeleton */}
        <HStack gap={2} mb={3}>
          {[72, 88, 64, 80].map((w) => (
            <Box key={w} w={`${w}px`} h="28px" borderRadius="full" bg="rgba(255,255,255,0.05)" />
          ))}
        </HStack>
        {/* Grid of shimmer cards */}
        <SimpleGrid columns={{ base: 2, sm: 3 }} gap={2.5} w="full">
          {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
        </SimpleGrid>
      </VStack>
    );
  }

  if (categories.length === 0) {
    return (
      <Box py={8} textAlign="center">
        <Text fontSize="sm" color="rgba(255,255,255,0.4)">No items available.</Text>
      </Box>
    );
  }

  return (
    <VStack align="start" gap={0} w="full">
      {/* Search bar */}
      <Box w="full" mb={3} position="relative">
        <Box
          position="absolute"
          left={3}
          top="50%"
          transform="translateY(-50%)"
          color="rgba(255,255,255,0.35)"
          pointerEvents="none"
          display="flex"
          alignItems="center"
        >
          <FiSearch size={14} />
        </Box>
        <Box asChild>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sofa, boxes, bed, fridge..."
            style={{
              width: "100%",
              padding: "9px 36px",
              borderRadius: "12px",
              border: "1.5px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "white",
              fontSize: "13px",
              outline: "none",
            }}
          />
        </Box>
        {searchQuery && (
          <Box
            as="button"
            position="absolute"
            right={3}
            top="50%"
            transform="translateY(-50%)"
            color="rgba(255,255,255,0.4)"
            display="flex"
            alignItems="center"
            cursor="pointer"
            onClick={() => setSearchQuery("")}
            _hover={{ color: "white" }}
          >
            <FiX size={14} />
          </Box>
        )}
      </Box>

      <SelectedItemsTray
        selectedItems={selectedItems}
        totalCount={totalCount}
        onIncrease={(item) => setSelectedItemQty(item, 1)}
        onDecrease={(item) => setSelectedItemQty(item, -1)}
        onClear={() => onItemsChange([])}
      />

      <Box
        w="full"
        display="flex"
        gap={2}
        overflowX="auto"
        pb={3}
        css={{ scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}
      >
        {SEARCH_SHORTCUTS.map((shortcut) => {
          const active = normalizeText(searchQuery) === normalizeText(shortcut);
          return (
            <Box
              key={shortcut}
              as="button"
              onClick={() => setSearchQuery(shortcut)}
              flexShrink={0}
              px={3}
              py={1.5}
              borderRadius="full"
              border={`1px solid ${active ? colors.amber : "rgba(255,255,255,0.12)"}`}
              bg={active ? "rgba(245,166,35,0.14)" : "rgba(255,255,255,0.035)"}
              color={active ? colors.amber : "rgba(255,255,255,0.68)"}
              fontSize="xs"
              fontWeight={800}
              cursor="pointer"
              _hover={{ borderColor: colors.amber, color: "white" }}
            >
              {shortcut}
            </Box>
          );
        })}
      </Box>

      {!searchQuery && popularItems.length > 0 && (
        <Box w="full" mb={4}>
          <HStack justify="space-between" align="center" mb={2}>
            <Text fontSize="sm" fontWeight={900} color="white">
              Popular items
            </Text>
            <Text fontSize="2xs" color="rgba(255,255,255,0.45)" fontWeight={700}>
              Tap to add
            </Text>
          </HStack>
          <Box
            display="flex"
            gap={2}
            overflowX="auto"
            pb={1}
            css={{ scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}
          >
            {popularItems.map(({ label, item }) => (
              <PopularItemButton
                key={`${label}-${item.id}`}
                label={label}
                item={item}
                quantity={getQty(item.id)}
                onIncrease={() => setQty(item, 1)}
                onDecrease={() => setQty(item, -1)}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Category tabs (hidden when searching) */}
      {!searchQuery && (
        <Box
          ref={tabsRef}
          w="full"
          display="flex"
          gap={2}
          overflowX="auto"
          pb={3}
          mb={1}
          css={{ scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}
        >
          {categories.map((cat, idx) => {
            const isActive = idx === activeCatIdx;
            const CategoryIcon = CATEGORY_ICONS[cat.icon] ?? FiPackage;
            const catCount = selectedItems
              .filter((s) => cat.items.some((i) => i.id === s.itemId))
              .reduce((sum, s) => sum + s.quantity, 0);
            return (
              <Box
                key={cat.id}
                data-tab
                as="button"
                onClick={() => setActiveCatIdx(idx)}
                flexShrink={0}
                px={3}
                py={1.5}
                borderRadius="full"
                border={`2px solid ${isActive ? colors.emerald : "rgba(255,255,255,0.1)"}`}
                bg={isActive ? "rgba(16,185,129,0.12)" : "transparent"}
                color={isActive ? colors.emerald : "rgba(255,255,255,0.55)"}
                fontSize="xs"
                fontWeight={600}
                cursor="pointer"
                transition="all 0.15s ease"
                position="relative"
              >
                <Box as="span" display="inline-flex" alignItems="center" mr={1.5} verticalAlign="-2px">
                  <CategoryIcon size={13} />
                </Box>
                {cat.name}
                {catCount > 0 && (
                  <Box
                    as="span"
                    display="inline-flex"
                    alignItems="center"
                    justifyContent="center"
                    ml={1.5}
                    px={1.5}
                    py={0.5}
                    borderRadius="full"
                    bg={colors.emerald}
                    color="white"
                    fontSize="2xs"
                    fontWeight={700}
                    lineHeight="1"
                  >
                    {catCount}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {/* Search header */}
      {searchQuery && searchResults !== null && (
        <Text fontSize="xs" color="rgba(255,255,255,0.4)" mb={2}>
          {searchResults.length === 0
            ? "No items found"
            : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`}
        </Text>
      )}

      {/* Item grid */}
      {displayItems.length === 0 ? (
        <Box
          w="full"
          py={8}
          px={4}
          borderRadius="xl"
          border="1px dashed rgba(255,255,255,0.16)"
          bg="rgba(255,255,255,0.025)"
          textAlign="center"
        >
          <Text fontSize="sm" fontWeight={800} color="white" mb={1}>
            No matching items
          </Text>
          <Text fontSize="xs" color="rgba(255,255,255,0.5)">
            Try sofa, bed, wardrobe, boxes, TV, fridge, desk, or table.
          </Text>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 2, sm: 3 }} gap={2.5} w="full">
          {displayItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              quantity={getQty(item.id)}
              onIncrease={() => setQty(item, 1)}
              onDecrease={() => setQty(item, -1)}
            />
          ))}
        </SimpleGrid>
      )}

    </VStack>
  );
}
