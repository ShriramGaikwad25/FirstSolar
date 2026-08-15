import { render, screen, fireEvent } from '@testing-library/react';
import { BackButton } from '../BackButton';
import { useRouter } from 'next/navigation';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockRouter = {
  back: jest.fn(),
};

describe('BackButton', () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    jest.clearAllMocks();
  });

  it('renders with default text and icon', () => {
    render(<BackButton />);
    
    expect(screen.getByText('Back')).toBeInTheDocument();
    expect(screen.getByLabelText('Go back to previous page')).toBeInTheDocument();
  });

  it('renders with custom text', () => {
    render(<BackButton text="Go Back" />);
    
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  it('calls router.back() when clicked', () => {
    render(<BackButton />);
    
    const button = screen.getByText('Back');
    fireEvent.click(button);
    
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('calls custom onClick handler when provided', () => {
    const customHandler = jest.fn();
    render(<BackButton onClick={customHandler} />);
    
    const button = screen.getByText('Back');
    fireEvent.click(button);
    
    expect(customHandler).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(<BackButton className="custom-class" />);
    
    const button = screen.getByText('Back');
    expect(button).toHaveClass('custom-class');
  });

  it('hides icon when showIcon is false', () => {
    render(<BackButton showIcon={false} />);
    
    // The icon should not be present
    const button = screen.getByText('Back');
    expect(button.querySelector('svg')).not.toBeInTheDocument();
  });
});


