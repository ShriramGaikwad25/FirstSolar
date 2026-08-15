'use client';

export function LoggedOutView() {
  const handleClose = () => {
    window.close();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
      <div className="text-center max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 px-8 py-10">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-7 w-7 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Logged Out</h1>
        <p className="text-gray-600 mb-8">
          You have been signed out successfully. You can close this window.
        </p>
        <button
          type="button"
          onClick={handleClose}
          className="w-full max-w-xs mx-auto bg-blue-600 text-white py-3 px-6 rounded-md font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          Close
        </button>
        <p className="text-xs text-gray-400 mt-4">
          If the tab does not close, close it manually from your browser.
        </p>
      </div>
    </div>
  );
}
