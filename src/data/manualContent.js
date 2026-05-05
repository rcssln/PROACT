export const MANUAL_CATEGORIES = [
  { id: 'basics', title: 'System Basics', icon: 'BookOpen' },
  { id: 'events', title: 'Events & Tracking', icon: 'CalendarCheck' },
  { id: 'reporting', title: 'Reporting & Data', icon: 'FilePlus' },
  { id: 'review', title: 'Review & Approvals', icon: 'CheckCircle' },
  { id: 'admin', title: 'Administration', icon: 'Users' }
];

export const MANUAL_SECTIONS = [
  {
    id: 'intro',
    category: 'basics',
    title: 'Overview of PROACT',
    roles: ['All'],
    description: 'PROACT is designed to streamline disaster response data from the local level to regional consolidation.',
    steps: [
      {
        title: 'Understanding the Dashboard',
        text: 'The dashboard displays aggregated data from all LGUs. You can see the number of active events, affected populations, and status of critical infrastructure at a glance.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      },
      {
        title: 'Navigating the Menu',
        text: 'Use the sidebar to access different modules. Depending on your role, you will see options for Managing Events, Adding Reports, or User Management.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      },
      {
        title: 'Real-time Updates',
        text: 'The system uses live connections. When an LGU submits a report or an admin updates an event, the changes are reflected across all dashboards immediately.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      }
    ]
  },
  {
    id: 'security-passwords',
    category: 'basics',
    title: 'Account Security & Passwords',
    roles: ['All'],
    description: 'Protecting your account ensures the integrity of disaster response data.',
    steps: [
      {
        title: 'First-time Login',
        text: 'When you first receive your invitation, you will be prompted to change your temporary password. Choose a strong password with at least 8 characters.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      },
      {
        title: 'Updating Passwords',
        text: 'You can change your password at any time via the Settings modal (gear icon at the bottom left). Regular updates are recommended.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      }
    ]
  },
  {
    id: 'manage-events-detailed',
    category: 'events',
    title: 'How to Manage Disaster Events',
    roles: ['Super Admin', 'Regional Admin', 'Provincial Admin'],
    description: 'Detailed guide on initiating and maintaining disaster events in the system.',
    steps: [
      {
        title: 'Creating a New Event',
        text: '1. Click "Manage Events" in the sidebar.\n2. Select "Add Event".\n3. Fill in the name, disaster type, and alert level.\n4. Select the affected provinces and LGUs.\n5. Click "Save" to deploy the event to relevant users.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      },
      {
        title: 'Updating Alert Levels',
        text: 'You can change an event\'s alert status (White, Blue, Yellow, Orange, Red) as the situation evolves. This will immediately update the dashboard for all users.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      },
      {
        title: 'Closing Events',
        text: 'Once a disaster response is concluded, mark the event as inactive. This archives the data but keeps it available for future reporting and analysis.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      }
    ]
  },
  {
    id: 'event-logs-detailed',
    category: 'events',
    title: 'Event Logs & Activity Tracking',
    roles: ['Super Admin', 'Regional Admin', 'Provincial Admin'],
    description: 'Monitor all system activities and data changes in real-time.',
    steps: [
      {
        title: 'Accessing Event Logs',
        text: 'Click the "Event Logs" icon in the sidebar. This view shows every major action taken within the system, tagged with the user and timestamp.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      },
      {
        title: 'Auditing Data Changes',
        text: 'Logs track when reports are created, edited, approved, or rejected. This ensures accountability and provides a clear trail for data verification.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      }
    ]
  },
  {
    id: 'add-report-detailed',
    category: 'reporting',
    title: 'LGU Reporting Workflow',
    roles: ['Super Admin', 'Regional Admin', 'Provincial Admin', 'Provincial', 'LGU Admin', 'LGU'],
    description: 'Guidelines for submitting accurate and timely situational reports.',
    steps: [
      {
        title: 'Selecting an Event',
        text: 'Only events deployed to your city or province will be visible. Select the active event you need to report for from the dropdown.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      },
      {
        title: 'Entering Data Categories',
        text: 'Data is organized into 15 categories (e.g., Affected Population, Damaged Houses, Power Status). Ensure you save each section before moving to the next.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      },
      {
        title: 'Saving Drafts',
        text: 'You don\'t have to complete the report in one go. Click "Save Draft" to store your progress and return to it later.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      },
      {
        title: 'Submitting for Approval',
        text: 'Once all sections are completed, click "Submit Report". Your report will move to the "Pending" status until reviewed by a Provincial or Regional officer.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      }
    ]
  },
  {
    id: 'consolidated-reports-detailed',
    category: 'reporting',
    title: 'Consolidated Reports & Data Analytics',
    roles: ['Super Admin', 'Regional Admin', 'Provincial Admin', 'Provincial Approver'],
    description: 'How to verify, edit, and consolidate data from multiple LGUs into official reports.',
    steps: [
      {
        title: 'Drill-down to LGU Data',
        text: 'Navigate to the Consolidated Report module. Click on an event, then a SitRep version to see data broken down by province and LGU.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      },
      {
        title: 'Editing and Verifying',
        text: 'Admins can directly edit or delete rows submitted by LGUs if corrections are needed before final approval.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      },
      {
        title: 'AI Summary Generation',
        text: 'Use the "Generate AI Summary" feature to quickly synthesize data into a readable format for executive briefs.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      },
      {
        title: 'Exporting Data',
        text: 'Generate PDF SitReps with official signatories or export raw data to CSV for external agency requirements.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      }
    ]
  },
  {
    id: 'review-workflow',
    category: 'review',
    title: 'Reviewing and Consolidating Reports',
    roles: ['Super Admin', 'Regional Admin', 'Provincial Admin', 'Provincial Approver'],
    description: 'How to verify LGU data and generate consolidated regional reports.',
    steps: [
      {
        title: 'Reviewing Submissions',
        text: 'Navigate to "Consolidated Report" to see pending LGU submissions. You can view details, request corrections, or approve the data.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      },
      {
        title: 'Managing SitRep Versions',
        text: 'The system maintains versions of reports (e.g., SitRep No. 1, No. 2). Ensure you are reviewing the latest version for the current reporting period.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      },
      {
        title: 'Generating Situational Reports (SitRep)',
        text: 'Once LGU data is approved, you can generate an official SitRep in PDF or Excel format for circulation to higher agencies.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      }
    ]
  },
  {
    id: 'rejection-handling',
    category: 'review',
    title: 'Handling Rejected Reports',
    roles: ['Super Admin', 'Regional Admin', 'Provincial Admin', 'Provincial'],
    description: 'Steps to take when a report requires correction.',
    steps: [
      {
        title: 'Reviewing Rejection Remarks',
        text: 'If a report is rejected, check the remarks provided by the reviewer. This will specify which sections need correction.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      },
      {
        title: 'Correcting and Resubmitting',
        text: 'Open the rejected report, make the necessary adjustments in the specific categories, and click "Resubmit" to send it back for review.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      }
    ]
  },
  {
    id: 'user-management-detailed',
    category: 'admin',
    title: 'Managing Accounts & Access',
    roles: ['Super Admin', 'Regional Admin', 'Provincial Admin'],
    description: 'Best practices for maintaining a secure and organized user directory.',
    steps: [
      {
        title: 'Tiered Permissions',
        text: 'Admins can only create accounts below their own tier. For example, a Provincial Admin can create LGU and local Provincial accounts but not Regional accounts.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      },
      {
        title: 'Account Status',
        text: 'Suspicious accounts can be deactivated immediately. "Pending" users are those who have been invited but have not yet completed their first login.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      },
      {
        title: 'Role Management',
        text: 'You can update a user\'s role or province as their responsibilities change. Changes take effect immediately upon their next login.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      }
    ]
  },
  {
    id: 'backup-restore-detailed',
    category: 'admin',
    title: 'System Maintenance: Backup & Restore',
    roles: ['Super Admin'],
    description: 'Protect system integrity with regular backups.',
    steps: [
      {
        title: 'Full System Backup',
        text: 'Navigate to Settings > Maintenance. Click "Backup Now" to download a complete ZIP archive of the database and all uploaded documents.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      },
      {
        title: 'Restoring from Backup',
        text: 'In the same menu, upload a valid backup ZIP to restore the system. Warning: This is a destructive action that overwrites current data.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      }
    ]
  },
  {
    id: 'invitation-troubleshooting',
    category: 'admin',
    title: 'User Invitations & Troubleshooting',
    roles: ['Super Admin', 'Regional Admin', 'Provincial Admin'],
    description: 'Handle issues during the user onboarding process.',
    steps: [
      {
        title: 'Inviting Users',
        text: 'Add a new user in the User Management module. The system will automatically try to send an email with their temporary password.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      },
      {
        title: 'Email Failure Fallback',
        text: 'If the email service fails, a notification will show the generated temporary password. You can manually copy and share this with the user securely.',
        visual: '/assets/help/dashboard_demo.webp',
        type: 'video'
      }
    ]
  }
];
