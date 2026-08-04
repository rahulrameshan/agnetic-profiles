def reverse(self):
    for i in range(len(self.list)):
        temp  = popleft(self.list)
        self.list.append(temp)
        i += 1
    return self.list