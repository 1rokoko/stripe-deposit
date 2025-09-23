export function Alert({ type = 'info', title, message, onClose }) {
  const types = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  return (
    <div className={`border rounded-lg p-4 ${types[type]}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <span className="text-lg">{icons[type]}</span>
        </div>
        <div className="ml-3 flex-1">
          {title && <h3 className="text-sm font-medium">{title}</h3>}
          <p className="text-sm">{message}</p>
        </div>
        {onClose && (
          <div className="ml-auto pl-3">
            <button onClick={onClose} className="text-sm hover:opacity-75">
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Alert;
