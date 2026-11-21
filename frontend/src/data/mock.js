// Access levels: 'read' or 'write'. Menus not listed in object = no access.
export const ACCESS_LEVELS = [
  { value: 'none', label: 'None' },
  { value: 'read', label: 'Read' },
  { value: 'write', label: 'Write' },
]

// Simulated dashboard chart and activity widgets (until dedicated business modules exist).
export const CHART_DATA = {
  daily: {
    labels: ['7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'],
    revenue: [32, 36, 31, 40, 44, 41, 48, 52, 47, 55, 58, 54, 62, 66],
    subscription: [18, 20, 19, 22, 25, 24, 27, 29, 28, 31, 33, 32, 35, 38],
  },
  weekly: {
    labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'],
    revenue: [210, 232, 228, 260, 275, 270, 301, 318, 310, 342, 355, 371],
    subscription: [120, 128, 131, 142, 150, 149, 165, 172, 170, 186, 192, 201],
  },
  monthly: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    revenue: [820, 870, 910, 990, 1040, 1010, 1120, 1190, 1160, 1260, 1330, 1400],
    subscription: [470, 495, 520, 560, 590, 580, 640, 680, 665, 720, 760, 800],
  },
}

export const TEAM_PULSE = [
  { label: 'Active chats', value: '27' },
  { label: 'Avg response time', value: '12 min' },
  { label: 'Critical tickets', value: '3' },
  { label: 'Tasks done today', value: '41' },
]

export const ACTIVITIES = [
  { id: 1, who: 'Siti Rahmawati', what: 'updated Inventory stock', time: '5m ago' },
  { id: 2, who: 'Budi Santoso', what: 'viewed Sales Reports', time: '18m ago' },
  { id: 3, who: 'Administrator', what: 'modified permissions for Dewi Lestari', time: '1h ago' },
  { id: 4, who: 'Siti Rahmawati', what: 'added a new customer', time: '2h ago' },
]
