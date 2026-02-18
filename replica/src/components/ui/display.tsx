import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as RechartsPrimitive from "recharts";
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import { ChevronLeft, ChevronRight, ArrowLeft, ArrowRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants, Button } from "./buttons";

// --- Avatar ---
const Avatar = React.forwardRef<React.ElementRef<typeof AvatarPrimitive.Root>, React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>>(
    ({ className, ...props }, ref) => (
        <AvatarPrimitive.Root ref={ref} className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)} {...props} />
    )
);
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
    React.ElementRef<typeof AvatarPrimitive.Image>,
    React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
    <AvatarPrimitive.Image ref={ref} className={cn("aspect-square h-full w-full", className)} {...props} />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
    React.ElementRef<typeof AvatarPrimitive.Fallback>,
    React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
    <AvatarPrimitive.Fallback
        ref={ref}
        className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}
        {...props}
    />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

// --- Table ---
const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
        <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, ...props }, ref) => <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, ...props }, ref) => (
        <tfoot ref={ref} className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
    )
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => (
    <tr ref={ref} className={cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)} {...props} />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
    <th
        ref={ref}
        className={cn("h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0", className)}
        {...props}
    />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
    <td ref={ref} className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
    ({ className, ...props }, ref) => <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
);
TableCaption.displayName = "TableCaption";

// --- Calendar ---
export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            className={cn("p-3", className)}
            classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-medium",
                nav: "space-x-1 flex items-center",
                nav_button: cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"),
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex",
                head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                row: "flex w-full mt-2",
                cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100"),
                day_range_end: "day-range-end",
                day_selected:
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                day_today: "bg-accent text-accent-foreground",
                day_outside:
                    "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                day_disabled: "text-muted-foreground opacity-50",
                day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                day_hidden: "invisible",
                ...classNames,
            }}
            components={{
                IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
                IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
            }}
            {...props}
        />
    );
}
Calendar.displayName = "Calendar";

// --- Chart ---
const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
    [k in string]: {
        label?: React.ReactNode;
        icon?: React.ComponentType;
    } & ({ color?: string; theme?: never } | { color?: never; theme: Record<keyof typeof THEMES, string> });
};

type ChartContextProps = {
    config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
    const context = React.useContext(ChartContext);
    if (!context) {
        throw new Error("useChart must be used within a <ChartContainer />");
    }
    return context;
}

const ChartContainer = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<"div"> & {
        config: ChartConfig;
        children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
    }
>(({ id, className, children, config, ...props }, ref) => {
    const uniqueId = React.useId();
    const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;
    return (
        <ChartContext.Provider value={{ config }}>
            <div
                data-chart={chartId}
                ref={ref}
                className={cn(
                    "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
                    className
                )}
                {...props}
            >
                <ChartStyle id={chartId} config={config} />
                <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
            </div>
        </ChartContext.Provider>
    );
});
ChartContainer.displayName = "Chart";

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
    const colorConfig = Object.entries(config).filter(([_, config]) => config.theme || config.color);
    if (!colorConfig.length) return null;
    return (
        <style
            dangerouslySetInnerHTML={{
                __html: Object.entries(THEMES)
                    .map(
                        ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
                                .map(([key, itemConfig]) => {
                                    const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] || itemConfig.color;
                                    return color ? `  --color-${key}: ${color};` : null;
                                })
                                .join("\n")}
}
`
                    )
                    .join("\n"),
            }}
        />
    );
};

const ChartTooltip = RechartsPrimitive.Tooltip;

const ChartTooltipContent = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.ComponentProps<"div"> & {
        hideLabel?: boolean;
        hideIndicator?: boolean;
        indicator?: "line" | "dot" | "dashed";
        nameKey?: string;
        labelKey?: string;
    }
>(
    (
        {
            active,
            payload,
            className,
            indicator = "dot",
            hideLabel = false,
            hideIndicator = false,
            label,
            labelFormatter,
            labelClassName,
            formatter,
            color,
            nameKey,
            labelKey,
        },
        ref
    ) => {
        const { config } = useChart();
        const tooltipLabel = React.useMemo(() => {
            if (hideLabel || !payload?.length) return null;
            const [item] = payload;
            const key = `${labelKey || item.dataKey || item.name || "value"}`;
            const itemConfig = getPayloadConfigFromPayload(config, item, key);
            const value = !labelKey && typeof label === "string" ? config[label as keyof typeof config]?.label || label : itemConfig?.label;
            if (labelFormatter) {
                return <div className={cn("font-medium", labelClassName)}>{labelFormatter(value, payload)}</div>;
            }
            if (!value) return null;
            return <div className={cn("font-medium", labelClassName)}>{value}</div>;
        }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);
        if (!active || !payload?.length) return null;
        const nestLabel = payload.length === 1 && indicator !== "dot";
        return (
            <div
                ref={ref}
                className={cn(
                    "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
                    className
                )}
            >
                {!nestLabel ? tooltipLabel : null}
                <div className="grid gap-1.5">
                    {payload.map((item, index) => {
                        const key = `${nameKey || item.name || item.dataKey || "value"}`;
                        const itemConfig = getPayloadConfigFromPayload(config, item, key);
                        const indicatorColor = color || item.payload.fill || item.color;
                        return (
                            <div
                                key={item.dataKey}
                                className={cn(
                                    "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                                    indicator === "dot" && "items-center"
                                )}
                            >
                                {formatter && item?.value !== undefined && item.name ? (
                                    formatter(item.value, item.name, item, index, item.payload)
                                ) : (
                                    <>
                                        {itemConfig?.icon ? (
                                            <itemConfig.icon />
                                        ) : (
                                            !hideIndicator && (
                                                <div
                                                    className={cn("shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]", {
                                                        "h-2.5 w-2.5": indicator === "dot",
                                                        "w-1": indicator === "line",
                                                        "w-0 border-[1.5px] border-dashed bg-transparent": indicator === "dashed",
                                                        "my-0.5": nestLabel && indicator === "dashed",
                                                    })}
                                                    style={
                                                        {
                                                            "--color-bg": indicatorColor,
                                                            "--color-border": indicatorColor,
                                                        } as React.CSSProperties
                                                    }
                                                />
                                            )
                                        )}
                                        <div className={cn("flex flex-1 justify-between leading-none", nestLabel ? "items-end" : "items-center")}>
                                            <div className="grid gap-1.5">
                                                {nestLabel ? tooltipLabel : null}
                                                <span className="text-muted-foreground">{itemConfig?.label || item.name}</span>
                                            </div>
                                            {item.value && (
                                                <span className="font-mono font-medium tabular-nums text-foreground">{item.value.toLocaleString()}</span>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
);
ChartTooltipContent.displayName = "ChartTooltip";

const ChartLegend = RechartsPrimitive.Legend;

const ChartLegendContent = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<"div"> &
    Pick<RechartsPrimitive.LegendProps, "payload" | "verticalAlign"> & {
        hideIcon?: boolean;
        nameKey?: string;
    }
>(({ className, hideIcon = false, payload, verticalAlign = "bottom", nameKey }, ref) => {
    const { config } = useChart();
    if (!payload?.length) return null;
    return (
        <div ref={ref} className={cn("flex items-center justify-center gap-4", verticalAlign === "top" ? "pb-3" : "pt-3", className)}>
            {payload.map((item) => {
                const key = `${nameKey || item.dataKey || "value"}`;
                const itemConfig = getPayloadConfigFromPayload(config, item, key);
                return (
                    <div key={item.value} className={cn("flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground")}>
                        {itemConfig?.icon && !hideIcon ? (
                            <itemConfig.icon />
                        ) : (
                            <div
                                className="h-2 w-2 shrink-0 rounded-[2px]"
                                style={{
                                    backgroundColor: item.color,
                                }}
                            />
                        )}
                        {itemConfig?.label}
                    </div>
                );
            })}
        </div>
    );
});
ChartLegendContent.displayName = "ChartLegend";

function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
    if (typeof payload !== "object" || payload === null) return undefined;
    const payloadPayload =
        "payload" in payload && typeof payload.payload === "object" && payload.payload !== null ? payload.payload : undefined;
    let configLabelKey: string = key;
    if (key in payload && typeof payload[key as keyof typeof payload] === "string") {
        configLabelKey = payload[key as keyof typeof payload] as string;
    } else if (payloadPayload && key in payloadPayload && typeof payloadPayload[key as keyof typeof payloadPayload] === "string") {
        configLabelKey = payloadPayload[key as keyof typeof payloadPayload] as string;
    }
    return configLabelKey in config ? config[configLabelKey] : config[key as keyof typeof config];
}

// --- Carousel ---
type CarouselApi = UseEmblaCarouselType[1];
type CarouselProps = {
    opts?: Parameters<typeof useEmblaCarousel>[0];
    plugins?: Parameters<typeof useEmblaCarousel>[1];
    orientation?: "horizontal" | "vertical";
    setApi?: (api: CarouselApi) => void;
};

type CarouselContextProps = {
    carouselRef: ReturnType<typeof useEmblaCarousel>[0];
    api: ReturnType<typeof useEmblaCarousel>[1];
    scrollPrev: () => void;
    scrollNext: () => void;
    canScrollPrev: boolean;
    canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
    const context = React.useContext(CarouselContext);
    if (!context) throw new Error("useCarousel must be used within a <Carousel />");
    return context;
}

const Carousel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & CarouselProps>(
    ({ orientation = "horizontal", opts, setApi, plugins, className, children, ...props }, ref) => {
        const [carouselRef, api] = useEmblaCarousel(
            { ...opts, axis: orientation === "horizontal" ? "x" : "y" },
            plugins
        );
        const [canScrollPrev, setCanScrollPrev] = React.useState(false);
        const [canScrollNext, setCanScrollNext] = React.useState(false);
        const onSelect = React.useCallback((api: CarouselApi) => {
            if (!api) return;
            setCanScrollPrev(api.canScrollPrev());
            setCanScrollNext(api.canScrollNext());
        }, []);
        const scrollPrev = React.useCallback(() => api?.scrollPrev(), [api]);
        const scrollNext = React.useCallback(() => api?.scrollNext(), [api]);
        const handleKeyDown = React.useCallback(
            (event: React.KeyboardEvent<HTMLDivElement>) => {
                if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    scrollPrev();
                } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    scrollNext();
                }
            },
            [scrollPrev, scrollNext]
        );
        React.useEffect(() => {
            if (!api || !setApi) return;
            setApi(api);
        }, [api, setApi]);
        React.useEffect(() => {
            if (!api) return;
            onSelect(api);
            api.on("reInit", onSelect);
            api.on("select", onSelect);
            return () => { api?.off("select", onSelect); };
        }, [api, onSelect]);
        return (
            <CarouselContext.Provider
                value={{
                    carouselRef,
                    api,
                    opts,
                    orientation: orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
                    scrollPrev,
                    scrollNext,
                    canScrollPrev,
                    canScrollNext,
                }}
            >
                <div
                    ref={ref}
                    onKeyDownCapture={handleKeyDown}
                    className={cn("relative", className)}
                    role="region"
                    aria-roledescription="carousel"
                    {...props}
                >
                    {children}
                </div>
            </CarouselContext.Provider>
        );
    }
);
Carousel.displayName = "Carousel";

const CarouselContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
    const { carouselRef, orientation } = useCarousel();
    return (
        <div ref={carouselRef} className="overflow-hidden">
            <div ref={ref} className={cn("flex", orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col", className)} {...props} />
        </div>
    );
});
CarouselContent.displayName = "CarouselContent";

const CarouselItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
    const { orientation } = useCarousel();
    return (
        <div
            ref={ref}
            role="group"
            aria-roledescription="slide"
            className={cn("min-w-0 shrink-0 grow-0 basis-full", orientation === "horizontal" ? "pl-4" : "pt-4", className)}
            {...props}
        />
    );
});
CarouselItem.displayName = "CarouselItem";

const CarouselPrevious = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
    ({ className, variant = "outline", size = "icon", ...props }, ref) => {
        const { orientation, scrollPrev, canScrollPrev } = useCarousel();
        return (
            <Button
                ref={ref}
                variant={variant}
                size={size}
                className={cn(
                    "absolute h-8 w-8 rounded-full",
                    orientation === "horizontal" ? "-left-12 top-1/2 -translate-y-1/2" : "-top-12 left-1/2 -translate-x-1/2 rotate-90",
                    className
                )}
                disabled={!canScrollPrev}
                onClick={scrollPrev}
                {...props}
            >
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Previous slide</span>
            </Button>
        );
    }
);
CarouselPrevious.displayName = "CarouselPrevious";

const CarouselNext = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
    ({ className, variant = "outline", size = "icon", ...props }, ref) => {
        const { orientation, scrollNext, canScrollNext } = useCarousel();
        return (
            <Button
                ref={ref}
                variant={variant}
                size={size}
                className={cn(
                    "absolute h-8 w-8 rounded-full",
                    orientation === "horizontal" ? "-right-12 top-1/2 -translate-y-1/2" : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
                    className
                )}
                disabled={!canScrollNext}
                onClick={scrollNext}
                {...props}
            >
                <ArrowRight className="h-4 w-4" />
                <span className="sr-only">Next slide</span>
            </Button>
        );
    }
);
CarouselNext.displayName = "CarouselNext";

// --- Hero Meeting Preview ---
function HeroMeetingPreview() {
    const participants = [
        { name: "Sarah Wilson", active: true, video: true, audio: true, color: "bg-indigo-500" },
        { name: "David Chen", active: false, video: true, audio: false, color: "bg-emerald-500" },
        { name: "Alex Thompson", active: false, video: true, audio: true, color: "bg-blue-500" },
        { name: "Maria Garcia", active: false, video: false, audio: true, color: "bg-rose-500" },
        { name: "James Wilson", active: false, video: true, audio: false, color: "bg-orange-500" },
        { name: "You", active: false, video: true, audio: true, color: "bg-gray-700" },
    ];

    return (
        <div className="relative w-full aspect-video bg-[#1C1C1C] rounded-xl shadow-2xl border border-[#333] overflow-hidden p-2 sm:p-4">
            {/* Meeting Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 h-full relative z-10">
                {participants.map((p, i) => (
                    <div key={i} className="relative bg-[#2A2A2A] rounded-lg overflow-hidden flex flex-col items-center justify-center group">
                        {p.video ? (
                            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full ${p.color} flex items-center justify-center text-white text-xl sm:text-2xl font-bold mb-2`}>
                                {p.name.charAt(0)}
                            </div>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <div className="w-20 h-20 rounded-full bg-[#333] flex items-center justify-center">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="w-8 h-8 text-gray-400"
                                    >
                                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                </div>
                            </div>
                        )}

                        {/* Name Tag */}
                        <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-white flex items-center gap-2">
                            {p.audio ? (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="w-3 h-3"
                                >
                                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                    <line x1="12" x2="12" y1="19" y2="22" />
                                </svg>
                            ) : (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="w-3 h-3 text-red-500"
                                >
                                    <line x1="2" x2="22" y1="2" y2="22" />
                                    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
                                    <path d="M5 10v2a7 7 0 0 0 12 5" />
                                    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
                                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                                    <line x1="12" x2="12" y1="19" y2="22" />
                                </svg>
                            )}
                            <span>{p.name}</span>
                        </div>

                        {/* Active Speaker Border */}
                        {p.active && (
                            <div className="absolute inset-0 border-2 border-[#0B5CFF] rounded-lg" />
                        )}
                    </div>
                ))}
            </div>

            {/* Floating Controls Overlay (Decorative) */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#1C1C1C]/90 backdrop-blur border border-[#333] px-6 py-3 rounded-full flex items-center gap-6 shadow-xl z-20">
                <div className="p-2 rounded-full hover:bg-[#333] text-white cursor-pointer">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-5 h-5"
                    >
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                </div>
                <div className="p-2 rounded-full hover:bg-[#333] text-white cursor-pointer">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-5 h-5"
                    >
                        <path d="m22 8-6 4 6 4V8Z" />
                        <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
                    </svg>
                </div>
                <div className="p-2 rounded-full hover:bg-[#333] text-[#0B5CFF] cursor-pointer">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-5 h-5"
                    >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                </div>
                <div className="bg-[#FF443B] text-white px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer">End</div>
            </div>
        </div>
    );
}

export {
    Avatar,
    AvatarImage,
    AvatarFallback,
    Table,
    TableHeader,
    TableBody,
    TableFooter,
    TableHead,
    TableRow,
    TableCell,
    TableCaption,
    Calendar,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
    ChartStyle,
    type CarouselApi,
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselPrevious,
    CarouselNext,
    HeroMeetingPreview,
};
