'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from 'next-themes';
import { Toaster as Sonner, ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
    const { theme = 'system' } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const content = (
        <div
            id="global-toast-portal"
            className="fixed top-5 right-5 z-[999999] pointer-events-none flex flex-col gap-2"
            style={{ zIndex: 999999 }}
        >
            <Sonner
                theme={theme as ToasterProps['theme']}
                position="top-right"
                visibleToasts={1}
                expand={false}
                className="toaster group"
                icons={{
                    error: (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white font-bold text-xs shadow-xs">
                            !
                        </span>
                    )
                }}
                style={
                    {
                        zIndex: 999999,
                        '--normal-bg': '#ffffff',
                        '--normal-text': '#0f172a',
                        '--normal-border': '#e2e8f0',
                    } as React.CSSProperties
                }
                toastOptions={{
                    className:
                        'pointer-events-auto !opacity-100 !backdrop-blur-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-l-4 border-l-rose-500 border border-slate-200 dark:border-slate-700 shadow-2xl px-4 py-3 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-3',
                    classNames: {
                        error: '!border-l-4 !border-l-rose-500 !bg-white dark:!bg-slate-900 !text-slate-900 dark:!text-white !opacity-100 !backdrop-blur-none !shadow-2xl',
                        toast: '!opacity-100 !backdrop-blur-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-l-4 border-rose-500 border border-slate-200 dark:border-slate-700 shadow-2xl px-4 py-3 rounded-xl pointer-events-auto',
                    },
                    style: {
                        zIndex: 999999,
                    }
                }}
                {...props}
            />
        </div>
    );

    if (!mounted || typeof document === 'undefined') {
        return null;
    }

    return createPortal(content, document.body);
};

export { Toaster };
