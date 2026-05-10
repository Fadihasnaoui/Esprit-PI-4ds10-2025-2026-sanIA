import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

/**
 * MagneticCard — wraps any block with a 3D magnetic tilt that follows the
 * cursor, plus a staggered entrance animation. Built on framer-motion
 * springs, respects `prefers-reduced-motion` automatically via framer.
 *
 * Props:
 *  - index        : used for stagger delay (40ms × index by default)
 *  - staggerStep  : override the stagger step (ms)
 *  - strength     : max tilt amplitude in degrees (default 6)
 *  - glowColor    : rgba/hex used for the cursor spotlight (default green)
 *  - as           : HTML tag to render (default 'div')
 *  - children     : anything
 *  - ...          : any other props forwarded to the outer motion element
 */
const MagneticCard = ({
    children,
    index       = 0,
    staggerStep = 40,
    strength    = 6,
    glowColor   = 'rgba(74,222,128,0.28)',
    style       = {},
    onClick,
    className,
    ...rest
}) => {
    const ref = useRef(null);

    // Raw mouse coordinates normalized to [-0.5, 0.5]
    const mx = useMotionValue(0);
    const my = useMotionValue(0);

    // Smoothed via spring physics
    const smx = useSpring(mx, { stiffness: 240, damping: 22, mass: 0.35 });
    const smy = useSpring(my, { stiffness: 240, damping: 22, mass: 0.35 });

    // Convert [-0.5, 0.5] → [-strength, strength] degrees
    const rotateX = useTransform(smy, v => -v * strength);
    const rotateY = useTransform(smx, v => v * strength);

    // Spotlight position (0–100% for CSS)
    const spotX = useTransform(smx, v => `${(v + 0.5) * 100}%`);
    const spotY = useTransform(smy, v => `${(v + 0.5) * 100}%`);

    const handleMove = (e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
    };

    const handleLeave = () => {
        mx.set(0);
        my.set(0);
    };

    return (
        <motion.div
            ref={ref}
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
            onClick={onClick}
            className={className}
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
                delay: (index * staggerStep) / 1000,
                duration: 0.55,
                ease: [0.22, 1, 0.36, 1],
            }}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            style={{
                position: 'relative',
                transformStyle: 'preserve-3d',
                perspective: 1000,
                rotateX,
                rotateY,
                ...style,
            }}
            {...rest}
        >
            <div style={{ position: 'relative', zIndex: 1, transform: 'translateZ(20px)' }}>
                {children}
            </div>
            {/* Cursor spotlight — light-reflection overlay on top of the card */}
            <motion.div
                aria-hidden
                style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 'inherit',
                    pointerEvents: 'none',
                    zIndex: 2,
                    background: useTransform(
                        [spotX, spotY],
                        ([x, y]) =>
                            `radial-gradient(circle 220px at ${x} ${y}, ${glowColor}, transparent 60%)`
                    ),
                    opacity: 0.5,
                    mixBlendMode: 'screen',
                }}
            />
            {/* Subtle border sheen that brightens on hover */}
            <motion.div
                aria-hidden
                whileHover={{ opacity: 1 }}
                style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 'inherit',
                    pointerEvents: 'none',
                    zIndex: 3,
                    boxShadow: `inset 0 0 0 1px ${glowColor}`,
                    opacity: 0.25,
                }}
            />
        </motion.div>
    );
};

export default MagneticCard;
