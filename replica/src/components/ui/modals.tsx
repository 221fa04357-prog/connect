import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { Check, Zap, Shield, Clock, Users, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants, Button } from "./buttons";
import { useAuthStore } from "@/stores/useAuthStore";

// --- Dialog ---
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            className
        )}
        {...props}
    />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
    <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
                className
            )}
            {...props}
        >
            {children}
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
        </DialogPrimitive.Content>
    </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

// --- Alert Dialog ---
const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
    React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Overlay
        className={cn(
            "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            className
        )}
        {...props}
        ref={ref}
    />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
    React.ElementRef<typeof AlertDialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
    <AlertDialogPortal>
        <AlertDialogOverlay />
        <AlertDialogPrimitive.Content
            ref={ref}
            className={cn(
                "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
                className
            )}
            {...props}
        />
    </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
    React.ElementRef<typeof AlertDialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => <AlertDialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold", className)} {...props} />);
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
    React.ElementRef<typeof AlertDialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
    React.ElementRef<typeof AlertDialogPrimitive.Action>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />);
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
    React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
    React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Cancel ref={ref} className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)} {...props} />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

// --- Subscription Modal ---
interface SubscriptionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function SubscriptionModal({ open, onOpenChange }: SubscriptionModalProps) {
    const { user } = useAuthStore();
    const handleUpgrade = () => {
        window.open("https://example.com/pricing", "_blank");
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full max-w-[95vw] sm:max-w-xl md:max-w-3xl bg-[#1C1C1C] border-[#333] text-white p-0 overflow-hidden gap-0 max-h-[90vh] overflow-y-auto no-scrollbar rounded-xl">
                <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Left Side - Visual */}
                    <div className="p-6 sm:p-8 bg-gradient-to-br from-[#0B5CFF] to-[#052e80] flex flex-col justify-between relative overflow-hidden min-h-[320px]">
                        <div className="absolute top-0 right-0 w-40 h-40 sm:w-64 sm:h-64 bg-white/10 rounded-full blur-3xl -mr-8 -mt-8 sm:-mr-16 sm:-mt-16 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-28 h-28 sm:w-48 sm:h-48 bg-black/20 rounded-full blur-2xl -ml-4 -mb-4 sm:-ml-10 sm:-mb-10 pointer-events-none"></div>
                        <div className="relative z-10">
                            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center mb-4 sm:mb-6">
                                <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" />
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Unlock Pro Features</h2>
                            <p className="text-blue-100 text-xs sm:text-sm leading-relaxed">
                                Take your meetings to the next level with extended duration, higher participant limits, and advanced recording controls.
                            </p>
                        </div>
                        <div className="relative z-10 mt-6 sm:mt-8 space-y-2 sm:space-y-3">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="p-1 bg-blue-500 rounded-full">
                                    <Clock className="w-3 h-3 text-white" />
                                </div>
                                <span className="text-xs sm:text-sm font-medium">Unlimited Meeting Duration</span>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="p-1 bg-blue-500 rounded-full">
                                    <Users className="w-3 h-3 text-white" />
                                </div>
                                <span className="text-xs sm:text-sm font-medium">Up to 500 Participants</span>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="p-1 bg-blue-500 rounded-full">
                                    <Shield className="w-3 h-3 text-white" />
                                </div>
                                <span className="text-xs sm:text-sm font-medium">Advanced Security Controls</span>
                            </div>
                        </div>
                    </div>
                    {/* Right Side - Plans */}
                    <div className="p-6 sm:p-8 bg-[#1C1C1C] flex flex-col justify-between">
                        <DialogHeader className="mb-4 sm:mb-6 text-left">
                            <DialogTitle className="text-lg sm:text-xl">Choose your plan</DialogTitle>
                            <DialogDescription className="text-gray-400">
                                Current Plan: <span className="text-white font-medium capitalize">{user?.subscriptionPlan || "Free"}</span>
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="border border-[#0B5CFF] bg-[#0B5CFF]/10 rounded-xl p-3 sm:p-4 relative">
                                <div className="absolute top-0 right-0 bg-[#0B5CFF] text-white text-[9px] sm:text-[10px] font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg uppercase tracking-wider">
                                    Recommended
                                </div>
                                <div className="flex justify-between items-start mb-1 sm:mb-2">
                                    <div>
                                        <h3 className="font-bold text-base sm:text-lg">Pro</h3>
                                        <p className="text-[10px] sm:text-xs text-blue-200">For small teams</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xl sm:text-2xl font-bold">₹999</span>
                                        <span className="text-xs text-gray-400">/mo</span>
                                    </div>
                                </div>
                                <ul className="space-y-1 sm:space-y-2 mt-2 sm:mt-3">
                                    {["Unlimited meeting time", "Cloud Recording (5GB)", "Social Media Streaming"].map((feature) => (
                                        <li key={feature} className="flex items-center gap-1 sm:gap-2 text-[11px] sm:text-xs text-gray-300">
                                            <Check className="w-3 h-3 text-[#0B5CFF]" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                                <Button onClick={handleUpgrade} className="w-full mt-3 sm:mt-4 bg-[#0B5CFF] hover:bg-[#0948c7] text-white h-8 sm:h-9 text-xs sm:text-sm">
                                    Upgrade to Pro
                                </Button>
                            </div>
                            <div className="text-center pt-1 sm:pt-2">
                                <p className="text-[10px] sm:text-xs text-gray-500 mb-1 sm:mb-2">Need more customization?</p>
                                <button className="text-[10px] sm:text-xs text-gray-300 hover:text-white underline underline-offset-2">
                                    View Enterprise Plans
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogClose,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
    AlertDialog,
    AlertDialogPortal,
    AlertDialogOverlay,
    AlertDialogTrigger,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
    SubscriptionModal,
};
