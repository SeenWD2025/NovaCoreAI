import toast from 'react-hot-toast';

export const showSuccess = (message: string) => {
  toast.success(message, {
    duration: 4000,
    position: 'top-right',
    style: {
      background: '#10b981',
      color: '#fff',
    },
    iconTheme: {
      primary: '#fff',
      secondary: '#10b981',
    },
  });
};

export const showError = (message: string) => {
  toast.error(message, {
    duration: 5000,
    position: 'top-right',
    style: {
      background: '#ef4444',
      color: '#fff',
    },
    iconTheme: {
      primary: '#fff',
      secondary: '#ef4444',
    },
  });
};

export const showInfo = (message: string) => {
  toast(message, {
    duration: 3000,
    position: 'top-right',
    icon: 'ℹ️',
    style: {
      background: '#3b82f6',
      color: '#fff',
    },
  });
};

export const showXPGain = (xp: number) => {
  toast.success(`+${xp} XP earned!`, {
    duration: 3000,
    position: 'top-right',
    icon: '⚡',
    style: {
      background: '#eab308',
      color: '#fff',
      fontWeight: 'bold',
    },
  });
};

export const showLevelUp = (level: number) => {
  toast.success(`Level Up! You're now Level ${level}!`, {
    duration: 5000,
    position: 'top-center',
    icon: '🎉',
    style: {
      background: 'linear-gradient(to right, #8b5cf6, #ec4899)',
      color: '#fff',
      fontWeight: 'bold',
      fontSize: '16px',
    },
  });
};

export const showAchievement = (achievement: string) => {
  toast.success(`Achievement Unlocked: ${achievement}`, {
    duration: 4000,
    position: 'top-center',
    icon: '🏆',
    style: {
      background: '#f59e0b',
      color: '#fff',
      fontWeight: 'bold',
    },
  });
};

export const showLoading = (message: string) => {
  return toast.loading(message, {
    position: 'top-right',
  });
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};
