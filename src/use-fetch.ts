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
import { DependencyList, useEffect, useState } from 'react';

export type PromiseWrapper = <T>(promise: Promise<T>) => Promise<T>;
export type Fetch<T> = (wrapper: PromiseWrapper) => Promise<T>;

export interface FetchSuccess<S> {
  data: S;
  status: 'success';
}

export interface FetchFailure<E = Error> {
  data: E;
  status: 'failure';
}

export interface FetchPending {
  data?: undefined;
  status: 'pending';
}

export type FetchResult<S, E = Error> =
  | FetchSuccess<S>
  | FetchFailure<E>
  | FetchPending;

export default function useFetch<S, E = Error>(
  fetcher: Fetch<S>,
  dependencies: DependencyList,
): FetchResult<S, E> {
  const [result, setResult] = useState<FetchResult<S, E>>({
    status: 'pending',
  });

  useEffect(() => {
    let mounted = true;

    setResult((current) => {
      if (current.status === 'pending') {
        return current;
      }
      return {
        status: 'pending',
      };
    });

    function wrap<T>(promise: Promise<T>) {
      return new Promise<T>((res, rej) => {
        promise.then(
          (value) => mounted && res(value),
          (value) => mounted && rej(value),
        );
      });
    }

    fetcher(wrap).then(
      (data) => {
        if (mounted) {
          setResult({
            status: 'success',
            data,
          });
        }
      },
      (data: E) => {
        if (mounted) {
          setResult({
            status: 'failure',
            data,
          });
        }
      },
    );

    return () => {
      mounted = false;
    };
  }, dependencies);

  return result;
}
