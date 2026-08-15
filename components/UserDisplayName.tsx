'use client';
import React from 'react';

interface UserDisplayNameProps {
  displayName: string;
  userType?: string | null;
  tags?: string | string[] | null;
  employeetype?: string | null;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Component that displays a user's display name with a "C" icon
 * positioned on the top right when the user type is "Contractor"
 */
export const UserDisplayName: React.FC<UserDisplayNameProps> = ({
  displayName,
  userType,
  tags,
  employeetype,
  className = '',
  style,
}) => {
  // Check if user is a Contractor (case-insensitive)
  const isContractor = React.useMemo(() => {
    const type = userType || employeetype || tags;
    if (!type) return false;
    
    // Handle array of tags
    if (Array.isArray(tags)) {
      return tags.some(tag => String(tag).toLowerCase() === 'contractor');
    }
    
    // Handle string values
    const typeStr = String(type).toLowerCase();
    return typeStr === 'contractor';
  }, [userType, tags, employeetype]);

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      style={style}
    >
      <span>{displayName}</span>
      {isContractor && (
        <span
          className="bg-green-600 text-white font-bold rounded-full inline-flex items-center justify-center"
          style={{
            fontSize: '0.75em',
            lineHeight: '1',
            width: '1.2em',
            height: '1.2em',
            minWidth: '1.2em',
            minHeight: '1.2em',
            verticalAlign: 'middle',
          }}
          title="Contractor"
        >
          C
        </span>
      )}
    </span>
  );
};

export default UserDisplayName;

