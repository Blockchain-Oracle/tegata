// The signature moment: a seal lands once, from slightly large and 8 px above, presses to 0.98 and settles (220 ms),
// with the `stamp` cue and a heavy haptic. Never loops; an identity keeps a revisit from pressing it again with sound.
// Reduced motion: a 100 ms fade.
import { type ReactNode, useEffect } from "react"
import type { StyleProp, ViewStyle } from "react-native"
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated"

import { type Cue, fire } from "@/feedback/fire"
import { MOTION } from "@/theme/tokens"

export function SealPress({
  children,
  play = true,
  delay = 0,
  identity,
  cue = "stamp",
  style,
  onLanded,
}: {
  children: ReactNode
  play?: boolean
  delay?: number
  /** A receipt id, a relay id: the sound plays once for it. */
  identity?: string
  cue?: Cue | null
  style?: StyleProp<ViewStyle>
  onLanded?: () => void
}) {
  const reduce = useReducedMotion()
  const progress = useSharedValue(play ? 0 : 1)
  const scale = useSharedValue(play && !reduce ? 1.12 : 1)
  const lift = useSharedValue(play && !reduce ? -8 : 0)

  useEffect(() => {
    if (!play) return
    const land = () => {
      if (cue) fire("impact", { cue, ...(identity ? { identity } : {}) })
      onLanded?.()
    }
    if (reduce) {
      progress.value = withDelay(delay, withTiming(1, { duration: 100 }, () => runOnJS(land)()))
      return
    }
    const ease = Easing.bezier(0.2, 0.8, 0.2, 1)
    const press = MOTION.seal * 0.55
    progress.value = withDelay(delay, withTiming(1, { duration: press }))
    lift.value = withDelay(delay, withTiming(0, { duration: press, easing: ease }))
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(0.98, { duration: press, easing: ease }, (done) => {
          if (done) runOnJS(land)()
        }),
        withTiming(1, { duration: MOTION.seal - press, easing: ease }),
      ),
    )
    // Plays once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play])

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: lift.value }, { scale: scale.value }],
  }))
  return <Animated.View style={[animated, style]}>{children}</Animated.View>
}
