/**
 * @license
 * MIT License
 *
 * Copyright (c) 2020 Alexis Munsayac
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 *
 * @author Alexis Munsayac <alexis.munsayac@gmail.com>
 * @copyright Alexis Munsayac 2020
 */
import {
  getDocument,
  GlobalWorkerOptions,
  PDFDocumentProxy,
  PDFPageProxy,
} from 'pdfjs-dist';
import React, {
  forwardRef,
  ReactNode,
  useRef,
} from 'react';
import pdfPromiseToES6 from './pdf-promise-to-es6';
import suspend from './suspend';
import useFetch from './use-fetch';
import useIsomorphicEffect from './use-isomorphic-effect';

export interface ByblosPropsBase {
  page?: number;
  scale?: number;
  onLoading?: () => void;
  onSuccess?: () => void;
  onFailure?: <E = Error>(error: E) => void;
  className?: string;
  loadingFallback?: ReactNode;
  errorFallback?: ReactNode;
}

export interface ByblosPropsURL extends ByblosPropsBase {
  type: 'url';
  value: string;
  fetchOptions?: RequestInit;
}

export interface ByblosPropsBlob extends ByblosPropsBase {
  type: 'blob';
  value: Blob;
  fetchOptions?: undefined;
}

export type ByblosProps = ByblosPropsURL | ByblosPropsBlob;

const Byblos = forwardRef<HTMLCanvasElement, ByblosProps>((props, ref) => {
  // Process PDF Data
  const bufferResult = useFetch(async (wrap) => {
    const response = (props.type === 'url')
      ? await wrap(fetch(props.value, props.fetchOptions))
      : new Response(props.value);
    return response.arrayBuffer();
  }, [props.type, props.value, props.fetchOptions]);

  // Process PDF Data into PDF Document
  const documentResult = useFetch<PDFDocumentProxy>(async (wrap) => {
    GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist/build/pdf.worker.min.js';

    if (bufferResult.status === 'success') {
      const task = getDocument(bufferResult.data);
      return wrap(pdfPromiseToES6(task.promise));
    }
    return suspend();
  }, [bufferResult]);

  // Parse PDF Document to Page
  const pageResult = useFetch<PDFPageProxy>(async (wrap) => {
    if (documentResult.status === 'success') {
      return wrap(pdfPromiseToES6(documentResult.data.getPage(props.page ?? 1)));
    }
    return suspend();
  }, [documentResult, props.page]);

  // Ref to canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const loading = bufferResult.status === 'pending'
    || documentResult.status === 'pending'
    || pageResult.status === 'pending';
  // Handle loading event
  useIsomorphicEffect(() => {
    if (loading && props.onLoading) {
      props.onLoading();
    }
  }, [props.onLoading, loading]);

  // Handle success event
  const success = pageResult.status === 'success';
  useIsomorphicEffect(() => {
    if (loading && props.onSuccess) {
      props.onSuccess();
    }
  }, [props.onSuccess, success]);

  // Handle error event
  const error = (bufferResult.status === 'failure' && bufferResult.data)
    || (documentResult.status === 'failure' && documentResult.data)
    || (pageResult.status === 'failure' && pageResult.data);
  useIsomorphicEffect(() => {
    if (error && props.onFailure) {
      props.onFailure(error);
    }
  }, [props.onFailure, error]);

  // Run rendering process
  useIsomorphicEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && pageResult.status === 'success') {
      const page = pageResult.data;
      const viewport = page.getViewport({
        scale: props.scale ?? 1,
      });
      const context = canvas.getContext('2d');

      if (!context) {
        return;
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      page.render({
        canvasContext: context,
        viewport,
      });
    }
  }, [canvasRef.current, pageResult.status, pageResult.data, props.scale]);

  if (loading) {
    return <>{ props.loadingFallback }</>;
  }
  if (error) {
    return <>{ props.errorFallback }</>;
  }

  return (
    <canvas
      ref={(instance) => {
        canvasRef.current = instance;
        if (typeof ref === 'function') {
          ref(instance);
        } else if (ref != null) {
          ref.current = instance;
        }
      }}
      className={props.className}
    />
  );
});

export default Byblos;
