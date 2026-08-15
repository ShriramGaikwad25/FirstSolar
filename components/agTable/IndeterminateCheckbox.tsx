import React from "react";
import { HTMLProps } from "react";

function IndeterminateCheckbox({
    indeterminate,
    className = '',
    ...rest
  }: { indeterminate?: boolean } & HTMLProps<HTMLInputElement>) {
    const ref = React.useRef<HTMLInputElement>(null);
  
    React.useEffect(() => {
      if (typeof indeterminate === 'boolean') {
        ref.current!.indeterminate = !rest.checked && indeterminate;
      }
    }, [rest.checked, ref, indeterminate]);
  
    return <input type="checkbox" ref={ref} className={`transform scale-[1.3] ${className} cursor-pointer`} {...rest} />;
  }
  export default IndeterminateCheckbox;